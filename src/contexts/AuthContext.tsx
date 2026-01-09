import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import {
  handleCallback,
  getStoredToken,
  clearTokens,
  getCurrentUser,
  getAccessLevel,
  getStoredUserId,
  isSessionExpired,
  isSessionExpiringSoon,
  getSessionTimeRemaining,
  extendSession,
  getDirectReports,
} from '../services/salesforce';
import { SalesforceUser, AccessLevel } from '../types';
import { SESSION_CONFIG } from '../constants';

interface AuthContextType {
  // Auth state
  isAuthenticated: boolean;
  isLoading: boolean;
  authError: string | null;

  // User state
  currentUser: SalesforceUser | null;
  currentUserId: string;
  accessLevel: AccessLevel;
  visibleUserIds: string[];
  loadingUserInfo: boolean;

  // Session state
  sessionExpiringSoon: boolean;
  sessionTimeRemaining: number;

  // Actions
  logout: () => void;
  extendUserSession: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // User state
  const [currentUser, setCurrentUser] = useState<SalesforceUser | null>(null);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('rep');
  const [visibleUserIds, setVisibleUserIds] = useState<string[]>([]);
  const [loadingUserInfo, setLoadingUserInfo] = useState(true);
  const currentUserIdRef = useRef<string>('');

  // Session state
  const [sessionExpiringSoon, setSessionExpiringSoon] = useState(false);
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(0);

  // Guard against StrictMode double-calling the callback handler
  const callbackProcessedRef = useRef(false);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      const isCallback = window.location.pathname === '/oauth/callback' ||
                        window.location.search.includes('code=') ||
                        window.location.search.includes('error=');

      if (isCallback) {
        // Prevent double-processing in React StrictMode
        if (callbackProcessedRef.current) {
          return;
        }
        callbackProcessedRef.current = true;
        try {
          const success = await handleCallback();
          window.history.replaceState({}, document.title, '/');

          if (success) {
            setIsAuthenticated(true);
            setAuthError(null);
          } else {
            clearTokens();
            setIsAuthenticated(false);
            setAuthError('Failed to complete login. Please try again.');
          }
        } catch (err) {
          console.error('Auth error:', err);
          clearTokens();
          setIsAuthenticated(false);
          setAuthError(err instanceof Error ? err.message : 'An error occurred during login');
          window.history.replaceState({}, document.title, '/');
        }
      } else {
        // Check for stored token AND valid session
        const token = getStoredToken();
        const sessionValid = !isSessionExpired();

        if (token && sessionValid) {
          setIsAuthenticated(true);
          setAuthError(null);
        } else if (token && !sessionValid) {
          // Token exists but session expired
          clearTokens();
          setIsAuthenticated(false);
          setAuthError('Your session has expired. Please log in again.');
        } else {
          setIsAuthenticated(false);
          setAuthError(null);
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  // Session monitoring - check periodically for expiry
  useEffect(() => {
    if (!isAuthenticated) return;

    const checkSession = () => {
      if (isSessionExpired()) {
        // Session expired - log out
        clearTokens();
        setIsAuthenticated(false);
        setAuthError('Your session has expired. Please log in again.');
        return;
      }

      // Update session state
      setSessionExpiringSoon(isSessionExpiringSoon());
      setSessionTimeRemaining(getSessionTimeRemaining());
    };

    // Check immediately
    checkSession();

    // Set up interval for periodic checks
    const intervalId = setInterval(checkSession, SESSION_CONFIG.CHECK_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [isAuthenticated]);

  // Load user info when authenticated
  useEffect(() => {
    const loadUserInfo = async () => {
      if (!isAuthenticated) {
        setLoadingUserInfo(false);
        return;
      }

      setLoadingUserInfo(true);
      try {
        const user = await getCurrentUser();
        if (user) {
          setCurrentUser(user);
          const level = getAccessLevel(user);
          setAccessLevel(level);

          const userId = getStoredUserId();
          if (userId) {
            currentUserIdRef.current = userId;

            // Determine visible users based on access level
            let userIds = [userId];
            if (level === 'manager' || level === 'director' || level === 'vp') {
              const reports = await getDirectReports(userId);
              userIds = [userId, ...reports.map(r => r.Id)];
            }
            // TODO: For director/VP, get recursive reports
            setVisibleUserIds(userIds);
          }
        }
      } catch (error) {
        console.error('Error loading user info:', error);
      } finally {
        setLoadingUserInfo(false);
      }
    };

    loadUserInfo();
  }, [isAuthenticated]);

  const logout = useCallback(() => {
    clearTokens();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setAccessLevel('rep');
    setVisibleUserIds([]);
    setAuthError(null);
  }, []);

  const extendUserSession = useCallback(() => {
    extendSession();
    setSessionExpiringSoon(false);
    setSessionTimeRemaining(SESSION_CONFIG.MAX_DURATION_MS);
  }, []);

  const value: AuthContextType = {
    isAuthenticated,
    isLoading,
    authError,
    currentUser,
    currentUserId: currentUserIdRef.current,
    accessLevel,
    visibleUserIds,
    loadingUserInfo,
    sessionExpiringSoon,
    sessionTimeRemaining,
    logout,
    extendUserSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
