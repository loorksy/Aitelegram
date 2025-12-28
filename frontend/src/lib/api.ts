import axios from 'axios';

// API Base URL - set via environment variable
const API_BASE_URL = import.meta.env.VITE_API_URL;

if (!API_BASE_URL) {
  console.warn('VITE_API_URL not set, using default');
}

const api = axios.create({
  baseURL: API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Try to refresh token
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          localStorage.setItem('accessToken', data.accessToken);
          error.config.headers.Authorization = `Bearer ${data.accessToken}`;
          return axios(error.config);
        } catch {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const login = async (telegramId: string) => {
  const { data } = await api.post('/auth/token', { telegramId });
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  return data;
};

export const getMe = async () => {
  const { data } = await api.get('/auth/me');
  return data.user;
};

// Credits
export const getBalance = async () => {
  const { data } = await api.get('/credits/balance');
  return data;
};

export const getCreditHistory = async () => {
  const { data } = await api.get('/credits/history');
  return data.transactions;
};

// Payments
export const getPaymentConfig = async () => {
  const { data } = await api.get('/payments/config');
  return data;
};

export const createPayment = async (starsAmount: number, chatId?: number) => {
  const { data } = await api.post('/payments/create', { starsAmount, chatId });
  return data;
};

export const getPaymentHistory = async () => {
  const { data } = await api.get('/payments/history');
  return data.payments;
};

export const getPaymentStats = async () => {
  const { data } = await api.get('/payments/stats');
  return data;
};

// Admin
export const getAdminStats = async () => {
  const { data } = await api.get('/admin/stats');
  return data;
};

export const getUsers = async (status?: string) => {
  const { data } = await api.get('/admin/users', { params: { status } });
  return data;
};

export const getUserById = async (userId: string) => {
  const { data } = await api.get(`/admin/users/${userId}`);
  return data;
};

export const approveUser = async (userId: string, initialCredits = 100) => {
  const { data } = await api.post(`/admin/users/${userId}/approve`, { initialCredits });
  return data;
};

export const denyUser = async (userId: string, reason?: string) => {
  const { data } = await api.post(`/admin/users/${userId}/deny`, { reason });
  return data;
};

export const setUserCredits = async (userId: string, credits: number, reason?: string) => {
  const { data } = await api.post(`/admin/users/${userId}/set-credits`, { credits, reason });
  return data;
};

export const setUserDailyLimit = async (userId: string, dailyLimit: number) => {
  const { data } = await api.post(`/admin/users/${userId}/set-daily-limit`, { dailyLimit });
  return data;
};

export const setUserRole = async (userId: string, role: string) => {
  const { data } = await api.post(`/admin/users/${userId}/set-role`, { role });
  return data;
};

export const getAdminPayments = async (status?: string) => {
  const { data } = await api.get('/admin/payments', { params: { status } });
  return data;
};

export const getAdminRuns = async (userId?: string, status?: string) => {
  const { data } = await api.get('/admin/runs', { params: { userId, status } });
  return data;
};

export const getAuditLogs = async (limit = 100) => {
  const { data } = await api.get('/admin/audit-logs', { params: { limit } });
  return data;
};
