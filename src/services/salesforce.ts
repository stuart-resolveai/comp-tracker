/**
 * Salesforce API Service
 * Handles OAuth authentication and API calls to Salesforce
 */

import { SalesforceUser, CompPlan, PlanTier, CompStatement, CompLineItem, SalesforceOpportunity, SalesforceQueryResponse, AccessLevel } from '../types';
import { STORAGE_KEYS, API_CONFIG, SESSION_CONFIG, MANAGER_ROLES, DIRECTOR_ROLES, VP_ROLES } from '../constants';

const CLIENT_ID = import.meta.env.VITE_SALESFORCE_CLIENT_ID;
const REDIRECT_URI = import.meta.env.VITE_SALESFORCE_REDIRECT_URI || `${window.location.origin}/oauth/callback`;
const AUTH_URL = 'https://login.salesforce.com';

// ============================================================================
// PKCE Helpers
// ============================================================================

async function generateCodeVerifier(): Promise<string> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// ============================================================================
// OAuth Flow
// ============================================================================

export async function initiateLogin(): Promise<void> {
  if (!CLIENT_ID) {
    throw new Error('VITE_SALESFORCE_CLIENT_ID is not set');
  }

  const codeVerifier = await generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = crypto.randomUUID();

  sessionStorage.setItem(STORAGE_KEYS.CODE_VERIFIER, codeVerifier);
  sessionStorage.setItem(STORAGE_KEYS.OAUTH_STATE, state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'api refresh_token',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: state,
  });

  window.location.href = `${AUTH_URL}/services/oauth2/authorize?${params.toString()}`;
}

export async function handleCallback(): Promise<boolean> {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const state = urlParams.get('state');
  const error = urlParams.get('error');

  if (error) {
    console.error('OAuth error:', error, urlParams.get('error_description'));
    return false;
  }

  const storedState = sessionStorage.getItem(STORAGE_KEYS.OAUTH_STATE);
  if (state !== storedState) {
    console.error('OAuth state mismatch - possible CSRF attack');
    return false;
  }

  if (!code) {
    console.error('No authorization code received');
    return false;
  }

  const codeVerifier = sessionStorage.getItem(STORAGE_KEYS.CODE_VERIFIER);
  if (!codeVerifier) {
    console.error('Code verifier not found - session may have expired');
    return false;
  }

  try {
    const tokenResponse = await fetch('/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: CLIENT_ID!,
        redirect_uri: REDIRECT_URI,
        code: code,
        code_verifier: codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorText);
      return false;
    }

    const tokenData = await tokenResponse.json();

    // Store tokens
    localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, tokenData.access_token);
    if (tokenData.refresh_token) {
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, tokenData.refresh_token);
    }
    localStorage.setItem(STORAGE_KEYS.INSTANCE_URL, tokenData.instance_url);
    localStorage.setItem(STORAGE_KEYS.USER_ID, tokenData.id.split('/').pop());
    localStorage.setItem(STORAGE_KEYS.SESSION_START, Date.now().toString());

    // Clean up session storage
    sessionStorage.removeItem(STORAGE_KEYS.CODE_VERIFIER);
    sessionStorage.removeItem(STORAGE_KEYS.OAUTH_STATE);

    return true;
  } catch (error) {
    console.error('Token exchange error:', error);
    return false;
  }
}

// ============================================================================
// Token Management
// ============================================================================

export function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
}

export function getStoredInstanceUrl(): string | null {
  return localStorage.getItem(STORAGE_KEYS.INSTANCE_URL);
}

export function getStoredUserId(): string | null {
  return localStorage.getItem(STORAGE_KEYS.USER_ID);
}

export function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.INSTANCE_URL);
  localStorage.removeItem(STORAGE_KEYS.USER_ID);
  localStorage.removeItem(STORAGE_KEYS.SESSION_START);
}

// ============================================================================
// Session Management
// ============================================================================

export function getSessionStart(): number | null {
  const stored = localStorage.getItem(STORAGE_KEYS.SESSION_START);
  if (!stored) return null;
  const timestamp = parseInt(stored, 10);
  return isNaN(timestamp) ? null : timestamp;
}

export function isSessionExpired(): boolean {
  const sessionStart = getSessionStart();
  if (!sessionStart) return true;
  return Date.now() - sessionStart > SESSION_CONFIG.MAX_DURATION_MS;
}

export function isSessionExpiringSoon(): boolean {
  const sessionStart = getSessionStart();
  if (!sessionStart) return false;
  const elapsed = Date.now() - sessionStart;
  const remaining = SESSION_CONFIG.MAX_DURATION_MS - elapsed;
  return remaining > 0 && remaining <= SESSION_CONFIG.WARNING_THRESHOLD_MS;
}

export function getSessionTimeRemaining(): number {
  const sessionStart = getSessionStart();
  if (!sessionStart) return 0;
  const remaining = SESSION_CONFIG.MAX_DURATION_MS - (Date.now() - sessionStart);
  return Math.max(0, remaining);
}

export function extendSession(): void {
  localStorage.setItem(STORAGE_KEYS.SESSION_START, Date.now().toString());
}

// ============================================================================
// API Request Helpers
// ============================================================================

async function apiRequest(
  endpoint: string,
  options: RequestInit = {},
  signal?: AbortSignal
): Promise<Response> {
  const accessToken = getStoredToken();
  const instanceUrl = getStoredInstanceUrl();

  if (!accessToken || !instanceUrl) {
    throw new Error('Not authenticated');
  }

  const url = `/api/salesforce${endpoint}${endpoint.includes('?') ? '&' : '?'}instance_url=${encodeURIComponent(instanceUrl)}`;

  const response = await fetch(url, {
    ...options,
    signal,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...options.headers,
    },
  });

  return response;
}

async function executeQuery<T>(soql: string, signal?: AbortSignal): Promise<T[]> {
  const response = await apiRequest(
    `/services/data/${API_CONFIG.SALESFORCE_API_VERSION}/query?q=${encodeURIComponent(soql)}`,
    {},
    signal
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Query failed: ${error}`);
  }

  const data: SalesforceQueryResponse<T> = await response.json();
  return data.records;
}

// ============================================================================
// User Functions
// ============================================================================

export async function getCurrentUser(): Promise<SalesforceUser | null> {
  const userId = getStoredUserId();
  if (!userId) return null;

  try {
    const query = `
      SELECT Id, Name, Email, Title, ManagerId,
             UserRole.Id, UserRole.Name
      FROM User
      WHERE Id = '${userId}'
    `;
    const records = await executeQuery<SalesforceUser>(query);
    return records[0] || null;
  } catch (error) {
    console.error('Error fetching current user:', error);
    return null;
  }
}

export function getAccessLevel(user: SalesforceUser): AccessLevel {
  const roleName = user.UserRole?.Name || '';

  if (VP_ROLES.some(role => roleName.includes(role))) {
    return 'vp';
  }
  if (DIRECTOR_ROLES.some(role => roleName.includes(role))) {
    return 'director';
  }
  if (MANAGER_ROLES.some(role => roleName.includes(role))) {
    return 'manager';
  }
  return 'rep';
}

export async function getDirectReports(managerId: string): Promise<SalesforceUser[]> {
  const query = `
    SELECT Id, Name, Email, Title, ManagerId, UserRole.Name
    FROM User
    WHERE ManagerId = '${managerId}'
    AND IsActive = true
  `;
  return executeQuery<SalesforceUser>(query);
}

// ============================================================================
// Comp Plan Functions
// ============================================================================

export async function getCompPlans(activeOnly: boolean = true): Promise<CompPlan[]> {
  const whereClause = activeOnly ? "WHERE Is_Active__c = true" : "";
  const query = `
    SELECT Id, Name, Role_Type__c, Plan_Level__c, Fiscal_Year__c,
           Metric_Type__c, Base_Rate__c, Quota_Target__c,
           Payout_Frequency__c, Is_Active__c, Effective_Date__c, End_Date__c
    FROM Comp_Plan__c
    ${whereClause}
    ORDER BY Fiscal_Year__c DESC, Role_Type__c, Plan_Level__c
  `;
  return executeQuery<CompPlan>(query);
}

export async function getPlanTiers(planId: string): Promise<PlanTier[]> {
  const query = `
    SELECT Id, Name, Comp_Plan__c, Attainment_Floor__c,
           Attainment_Ceiling__c, Commission_Rate__c, Order__c
    FROM Plan_Tier__c
    WHERE Comp_Plan__c = '${planId}'
    ORDER BY Order__c ASC, Attainment_Floor__c ASC
  `;
  return executeQuery<PlanTier>(query);
}

// ============================================================================
// Comp Statement Functions
// ============================================================================

export async function getStatements(
  userId: string,
  fiscalPeriod?: string
): Promise<CompStatement[]> {
  let whereClause = `WHERE User__c = '${userId}'`;
  if (fiscalPeriod) {
    whereClause += ` AND Fiscal_Period__c = '${fiscalPeriod}'`;
  }

  const query = `
    SELECT Id, Name, User__c, User__r.Name, Comp_Plan__c, Comp_Plan__r.Name,
           Period_Type__c, Period_Start__c, Period_End__c, Fiscal_Period__c,
           Quota_Amount__c, Achieved_Amount__c, Achieved_Count__c,
           Gross_Commission__c, Adjustments_Amount__c, Net_Commission__c,
           Status__c, Approved_By__c, Approval_Date__c
    FROM Comp_Statement__c
    ${whereClause}
    ORDER BY Period_Start__c DESC
  `;
  return executeQuery<CompStatement>(query);
}

export async function getStatementsForUsers(
  userIds: string[],
  fiscalPeriod?: string
): Promise<CompStatement[]> {
  const idList = userIds.map(id => `'${id}'`).join(',');
  let whereClause = `WHERE User__c IN (${idList})`;
  if (fiscalPeriod) {
    whereClause += ` AND Fiscal_Period__c = '${fiscalPeriod}'`;
  }

  const query = `
    SELECT Id, Name, User__c, User__r.Name, Comp_Plan__c, Comp_Plan__r.Name,
           Period_Type__c, Period_Start__c, Period_End__c, Fiscal_Period__c,
           Quota_Amount__c, Achieved_Amount__c, Achieved_Count__c,
           Gross_Commission__c, Adjustments_Amount__c, Net_Commission__c,
           Status__c, Approved_By__c, Approval_Date__c
    FROM Comp_Statement__c
    ${whereClause}
    ORDER BY Period_Start__c DESC
  `;
  return executeQuery<CompStatement>(query);
}

// ============================================================================
// Comp Line Item Functions
// ============================================================================

export async function getLineItems(statementId: string): Promise<CompLineItem[]> {
  const query = `
    SELECT Id, Name, Comp_Statement__c, Opportunity__c,
           Opportunity__r.Name, Opportunity__r.Amount, Opportunity__r.CloseDate,
           Opportunity__r.Account.Name,
           Record_Type__c, Credit_Amount__c, Commission_Rate__c,
           Commission_Amount__c, Tier_Applied__c, Split_Percent__c,
           Attribution_Type__c, Is_Disputed__c
    FROM Comp_Line_Item__c
    WHERE Comp_Statement__c = '${statementId}'
    ORDER BY Opportunity__r.CloseDate ASC
  `;
  return executeQuery<CompLineItem>(query);
}

// ============================================================================
// Opportunity Functions (for commission calculation)
// ============================================================================

export async function getClosedWonOpportunities(
  ownerId: string,
  startDate: string,
  endDate: string
): Promise<SalesforceOpportunity[]> {
  const query = `
    SELECT Id, Name, AccountId, Account.Name, Amount, StageName,
           CloseDate, OwnerId, Owner.Name, SDR__c, Solutions_Engineer__c,
           CreatedDate
    FROM Opportunity
    WHERE OwnerId = '${ownerId}'
    AND StageName = 'Closed Won'
    AND CloseDate >= ${startDate}
    AND CloseDate <= ${endDate}
    ORDER BY CloseDate ASC
  `;
  return executeQuery<SalesforceOpportunity>(query);
}

export async function getOpportunitiesForSE(
  seId: string,
  startDate: string,
  endDate: string
): Promise<SalesforceOpportunity[]> {
  const query = `
    SELECT Id, Name, AccountId, Account.Name, Amount, StageName,
           CloseDate, OwnerId, Owner.Name, SDR__c, Solutions_Engineer__c,
           CreatedDate
    FROM Opportunity
    WHERE Solutions_Engineer__c = '${seId}'
    AND StageName = 'Closed Won'
    AND CloseDate >= ${startDate}
    AND CloseDate <= ${endDate}
    ORDER BY CloseDate ASC
  `;
  return executeQuery<SalesforceOpportunity>(query);
}

export async function getStage0OpportunitiesForSDR(
  sdrId: string,
  startDate: string,
  endDate: string
): Promise<SalesforceOpportunity[]> {
  const query = `
    SELECT Id, Name, AccountId, Account.Name, Amount, StageName,
           CloseDate, OwnerId, Owner.Name, SDR__c, Solutions_Engineer__c,
           CreatedDate
    FROM Opportunity
    WHERE SDR__c = '${sdrId}'
    AND CreatedDate >= ${startDate}T00:00:00Z
    AND CreatedDate <= ${endDate}T23:59:59Z
    ORDER BY CreatedDate ASC
  `;
  return executeQuery<SalesforceOpportunity>(query);
}
