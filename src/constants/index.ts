// Storage keys for localStorage/sessionStorage
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'sf_access_token',
  REFRESH_TOKEN: 'sf_refresh_token',
  INSTANCE_URL: 'sf_instance_url',
  USER_ID: 'sf_user_id',
  SESSION_START: 'sf_session_start',
  CODE_VERIFIER: 'sf_code_verifier',
  OAUTH_STATE: 'sf_oauth_state',
};

// API configuration
export const API_CONFIG = {
  REQUEST_TIMEOUT_MS: 30000,
  SALESFORCE_API_VERSION: 'v59.0',
  QUERY_LIMIT: 1000,
};

// Session configuration
export const SESSION_CONFIG = {
  MAX_DURATION_MS: 24 * 60 * 60 * 1000, // 24 hours
  WARNING_THRESHOLD_MS: 30 * 60 * 1000, // 30 min warning
  CHECK_INTERVAL_MS: 60 * 1000, // Check every 1 min
};

// Role definitions
export const REP_ROLE = 'Account Executive';
export const MANAGER_ROLES = ['CEO', 'VP of Sales', 'Sales Manager', 'Chief of Staff'];
export const DIRECTOR_ROLES = ['Director of Sales', 'Director'];
export const VP_ROLES = ['VP of Sales', 'VP', 'CEO'];

// Fiscal year configuration (Feb 1 start)
export const FISCAL_YEAR_START_MONTH = 1; // February (0-indexed)
