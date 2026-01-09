// Salesforce Types
export interface SalesforceUser {
  Id: string;
  Name: string;
  Email: string;
  Title?: string;
  ManagerId?: string;
  UserRole?: {
    Id: string;
    Name: string;
  };
}

export interface SalesforceOpportunity {
  Id: string;
  Name: string;
  AccountId?: string;
  Account?: {
    Id: string;
    Name: string;
  };
  Amount: number;
  StageName: string;
  CloseDate: string;
  OwnerId: string;
  Owner?: {
    Id: string;
    Name: string;
  };
  SDR__c?: string;
  Solutions_Engineer__c?: string;
  CreatedDate: string;
}

// Comp Plan Types
export interface CompPlan {
  Id: string;
  Name: string;
  Role_Type__c: 'AE' | 'SDR' | 'SE';
  Plan_Level__c: 'IC' | 'Manager' | 'Director' | 'VP';
  Fiscal_Year__c: string;
  Metric_Type__c: 'Bookings' | 'Stage0_Opps' | 'Overlay_Bookings';
  Base_Rate__c?: number;
  Quota_Target__c?: number;
  Payout_Frequency__c: 'Monthly' | 'Quarterly';
  Is_Active__c: boolean;
  Effective_Date__c?: string;
  End_Date__c?: string;
}

export interface PlanTier {
  Id: string;
  Name: string;
  Comp_Plan__c: string;
  Attainment_Floor__c: number;
  Attainment_Ceiling__c?: number;
  Commission_Rate__c: number;
  Order__c?: number;
}

// Comp Statement Types
export interface CompStatement {
  Id: string;
  Name: string;
  User__c: string;
  User__r?: SalesforceUser;
  Comp_Plan__c?: string;
  Comp_Plan__r?: CompPlan;
  Period_Type__c: 'Monthly' | 'Quarterly';
  Period_Start__c: string;
  Period_End__c: string;
  Fiscal_Period__c: string;
  Quota_Amount__c?: number;
  Achieved_Amount__c?: number;
  Achieved_Count__c?: number;
  Gross_Commission__c?: number;
  Adjustments_Amount__c?: number;
  Net_Commission__c?: number;
  Status__c: 'Draft' | 'Pending_Review' | 'Approved' | 'Paid' | 'Disputed';
  Approved_By__c?: string;
  Approval_Date__c?: string;
}

export interface CompLineItem {
  Id: string;
  Name: string;
  Comp_Statement__c: string;
  Opportunity__c?: string;
  Opportunity__r?: SalesforceOpportunity;
  Record_Type__c: 'AE_Booking' | 'SDR_Source' | 'SE_Overlay';
  Credit_Amount__c?: number;
  Commission_Rate__c?: number;
  Commission_Amount__c?: number;
  Tier_Applied__c?: string;
  Split_Percent__c?: number;
  Attribution_Type__c?: 'Owner' | 'SE_Attached' | 'SDR_Source';
  Is_Disputed__c: boolean;
}

// Auth Types
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: SalesforceUser | null;
  accessToken: string | null;
  instanceUrl: string | null;
  error: string | null;
}

export type AccessLevel = 'rep' | 'manager' | 'director' | 'vp' | 'admin';

// Calculation Types
export interface TierBreakdown {
  tierName: string;
  bookingsInTier: number;
  rateApplied: number;
  commissionAmount: number;
}

export interface CommissionCalculation {
  grossCommission: number;
  tierBreakdown: TierBreakdown[];
  attainmentPercent: number;
}

// API Response Types
export interface SalesforceQueryResponse<T> {
  totalSize: number;
  done: boolean;
  records: T[];
  nextRecordsUrl?: string;
}
