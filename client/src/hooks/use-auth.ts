import { create } from 'zustand';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type InsertUser } from '@shared/routes';
import { useToast } from '@/hooks/use-toast';

// Types derived from schema
type User = {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  online: boolean | null;
  lastSeen: Date | null;
};

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

// Zustand store for local auth state
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('auth_token'),
  isAuthenticated: !!localStorage.getItem('auth_token'),
  setAuth: (user, token) => {
    localStorage.setItem('auth_token', token);
    set({ user, token, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('auth_token');
    set({ user: null, token: null, isAuthenticated: false });
  },
}));

// Hooks for API interactions
export function useRegister() {
  const { setAuth } = useAuthStore();
  const { toast } = useToast();
  
  return useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await fetch(api.auth.register.path, {
        method: api.auth.register.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Registration failed');
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      setAuth(data.user, data.token);
      toast({ title: 'Welcome!', description: 'Account created successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });
}

export function useLogin() {
  const { setAuth } = useAuthStore();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (credentials: Pick<InsertUser, 'username' | 'password'>) => {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Login failed');
      }

      return await res.json();
    },
    onSuccess: (data) => {
      setAuth(data.user, data.token);
      toast({ title: 'Welcome back!', description: 'Logged in successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });
}

// Check current session
export function useMe() {
  const { setAuth, logout } = useAuthStore();
  
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('No token');
      
      const res = await fetch(api.auth.me.path, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.status === 401) {
        logout();
        return null;
      }
      
      if (!res.ok) throw new Error('Failed to fetch user');
      
      const user = await res.json();
      // If we got the user, update the store to ensure sync
      if (user) {
        // We reuse the token we have
        setAuth(user, token);
      }
      return user;
    },
    retry: false,
    staleTime: 1000 * 60 * 5 // 5 minutes
  });
}
