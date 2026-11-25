import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { setAuthToken, registerTokenRefreshHandler } from '@/services/api';
import { Activity } from 'lucide-react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessTokenState] = useState(null); // IN-MEMORY ONLY
  const [isLoading, setIsLoading] = useState(true);

  // Synchronize in-memory access token with Axios
  const updateAccessToken = useCallback((token) => {
    setAccessTokenState(token);
    setAuthToken(token);
  }, []);

  // Fetch current user details using access token
  const loadUser = useCallback(async (token) => {
    try {
      const res = await api.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data?.success) {
        setUser(res.data.data.user);
        return res.data.data.user;
      }
    } catch (err) {
      console.warn('[AuthContext] Failed to load user profile:', err.message);
    }
    return null;
  }, []);

  // Silent session restore on initial page load
  useEffect(() => {
    registerTokenRefreshHandler((newToken) => {
      setAccessTokenState(newToken);
    });

    let isMounted = true;

    async function restoreSession() {
      try {
        const refreshRes = await api.post('/api/auth/refresh');
        if (refreshRes.data?.success && isMounted) {
          const token = refreshRes.data.data.accessToken;
          updateAccessToken(token);
          await loadUser(token);
        }
      } catch (_err) {
        // No active refresh session or invalid session, normal for guest
        if (isMounted) {
          updateAccessToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, [updateAccessToken, loadUser]);

  // Login handler
  const login = async (email, password, rememberMe = true) => {
    const res = await api.post('/api/auth/login', { email, password, rememberMe });
    if (res.data?.success) {
      const { user: userData, accessToken: token } = res.data.data;
      updateAccessToken(token);
      setUser(userData);
      return userData;
    }
    throw new Error(res.data?.error || 'Login failed');
  };

  // Register handler (patients)
  const register = async (patientData) => {
    const res = await api.post('/api/auth/register', patientData);
    if (res.data?.success) {
      const { user: userData, accessToken: token } = res.data.data;
      updateAccessToken(token);
      setUser(userData);
      return userData;
    }
    throw new Error(res.data?.error || 'Registration failed');
  };

  // Logout handler
  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (_err) {
      // Ignore network errors on logout
    } finally {
      updateAccessToken(null);
      setUser(null);
    }
  };

  // Logout all sessions
  const logoutAll = async () => {
    try {
      await api.post('/api/auth/logout-all');
    } catch (_err) {
      // Ignore
    } finally {
      updateAccessToken(null);
      setUser(null);
    }
  };

  // Change password handler
  const changePassword = async (currentPassword, newPassword) => {
    const res = await api.post('/api/auth/change-password', {
      currentPassword,
      newPassword
    });
    if (res.data?.success) {
      setUser((prev) => (prev ? { ...prev, mustChangePassword: false } : null));
      return res.data;
    }
    throw new Error(res.data?.error || 'Password change failed');
  };

  // Full-screen clinical splash loader during initial session restore
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#08101E] text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center space-y-5">
          <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-teal-500/10 border border-teal-500/20 shadow-xl shadow-teal-500/10">
            <Activity className="w-10 h-10 text-teal-400 animate-heartbeat" />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
              PulseCare <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-mono">IoT Hospital</span>
            </h1>
            <p className="text-xs text-slate-400">Verifying secure clinical credentials...</p>
          </div>
          <div className="w-48 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className="w-1/2 h-full bg-teal-400 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  const value = {
    user,
    setUser,
    accessToken,
    isAuthenticated: Boolean(user && accessToken),
    isLoading,
    login,
    register,
    logout,
    logoutAll,
    changePassword,
    loadUser
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

export default AuthContext;
