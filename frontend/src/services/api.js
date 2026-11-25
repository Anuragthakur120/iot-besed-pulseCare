import axios from 'axios';

let inMemoryAccessToken = null;
let onTokenRefreshedCallback = null;

export const setAuthToken = (token) => {
  inMemoryAccessToken = token;
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

export const registerTokenRefreshHandler = (cb) => {
  onTokenRefreshedCallback = cb;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request Interceptor: Attach in-memory access token
api.interceptors.request.use(
  (config) => {
    if (inMemoryAccessToken && !config.headers['Authorization']) {
      config.headers['Authorization'] = `Bearer ${inMemoryAccessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

/**
 * Extracts human-readable error messages from Axios response errors
 * Prevents raw 'Request failed with status code 400' messages from being shown to users.
 */
export const getErrorMessage = (error, fallback = 'An unexpected error occurred') => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;

  // 1. Zod validation errors array: { errors: [{ field, message }] }
  if (Array.isArray(error.response?.data?.errors) && error.response.data.errors.length > 0) {
    return error.response.data.errors.map((e) => e.message).join('. ');
  }

  // 2. Direct error property from backend: { error: '...' }
  if (error.response?.data?.error) {
    return error.response.data.error;
  }

  // 3. Message property if informative: { message: '...' }
  if (
    error.response?.data?.message &&
    error.response.data.message !== 'Request validation failed' &&
    error.response.data.message !== 'Validation failed'
  ) {
    return error.response.data.message;
  }

  // 4. Raw text response body
  if (typeof error.response?.data === 'string' && error.response.data.trim()) {
    return error.response.data.trim();
  }

  // 5. Existing message if not generic Axios status message
  if (error.message && !error.message.startsWith('Request failed with status code')) {
    return error.message;
  }

  // 6. Friendly status code defaults
  const status = error.response?.status;
  if (status === 400) return 'Invalid request or credential format. Please check your input.';
  if (status === 401) return 'Invalid email address or password.';
  if (status === 403) return 'Access denied. You do not have permission for this action.';
  if (status === 404) return 'Requested account or resource was not found.';
  if (status === 409) return 'An account with this email address already exists.';
  if (status === 423) return 'Account is temporarily locked due to multiple failed login attempts. Please try again later.';
  if (status === 429) return 'Too many attempts. Please wait a moment before trying again.';
  if (status >= 500) return 'Internal server error. Please try again shortly.';

  return error.message || fallback;
};

// Response Interceptor: Auto-refresh tokens on 401 once & normalize error messages
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Enrich error.message with user-friendly backend message
    const friendlyMsg = getErrorMessage(error, null);
    if (friendlyMsg) {
      error.message = friendlyMsg;
    }

    const originalRequest = error.config;

    const isAuthRoute =
      originalRequest?.url?.includes('/api/auth/login') ||
      originalRequest?.url?.includes('/api/auth/refresh') ||
      originalRequest?.url?.includes('/api/auth/register');

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthRoute) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshResponse = await api.post('/api/auth/refresh');
        const newToken = refreshResponse.data?.data?.accessToken;

        setAuthToken(newToken);
        if (onTokenRefreshedCallback) {
          onTokenRefreshedCallback(newToken);
        }

        processQueue(null, newToken);
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        setAuthToken(null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
export { api };
