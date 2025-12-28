import { create } from 'zustand';

interface User {
  id: string;
  name: string | null;
  username: string | null;
  telegramId: string;
  role: 'OWNER' | 'ADMIN' | 'USER';
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'DENIED' | 'SUSPENDED';
  credits: number;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  logout: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, isAuthenticated: false });
  }
}));