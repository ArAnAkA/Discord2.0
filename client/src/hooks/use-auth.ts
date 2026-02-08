import { useEffect } from "react";
import { create } from 'zustand';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@shared/routes';
import type { InsertUser } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { disconnectSocket } from "@/lib/socket";

// Types derived from schema
export type AuthUser = {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  online: boolean | null;
  lastSeen: string | null;
};

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitialized: boolean;
  setAuth: (user: AuthUser) => void;
  setLoggedOut: () => void;
}

// Zustand store for local auth state
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isInitialized: false,
  setAuth: (user) => set({ user, isAuthenticated: true, isInitialized: true }),
  setLoggedOut: () => set({ user: null, isAuthenticated: false, isInitialized: true }),
}));

// Hooks for API interactions
export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await fetch(api.auth.register.path, {
        method: api.auth.register.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Registration failed');
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      setAuth(data.user);
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      toast({ title: 'Welcome!', description: 'Account created successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: Pick<InsertUser, 'username' | 'password'>) => {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Login failed');
      }

      return await res.json();
    },
    onSuccess: (data) => {
      setAuth(data.user);
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      toast({ title: 'Welcome back!', description: 'Logged in successfully.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });
}

export function useLogout() {
  const setLoggedOut = useAuthStore((s) => s.setLoggedOut);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await fetch(api.auth.logout.path, {
        method: api.auth.logout.method,
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Logout failed");
      }
    },
    onSuccess: () => {
      setLoggedOut();
      disconnectSocket();
      queryClient.clear();
    },
  });
}

export function useUpdateProfile() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (profile: { displayName?: string; avatarUrl?: string }) => {
      const res = await fetch(api.users.me.update.path, {
        method: api.users.me.update.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(profile),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update profile");
      }

      return (await res.json()) as AuthUser;
    },
    onSuccess: (user) => {
      setAuth(user);
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      toast({ title: "Saved", description: "Profile updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

// Check current session
export function useMe() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const setLoggedOut = useAuthStore((s) => s.setLoggedOut);
  
  const query = useQuery<AuthUser | null>({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path, {
        credentials: "include",
      });
      
      if (res.status === 401) {
        return null;
      }
      
      if (!res.ok) throw new Error('Failed to fetch user');
      
      const user = await res.json();
      return user as AuthUser;
    },
    retry: false,
    staleTime: 1000 * 60 * 5 // 5 minutes
  });

  useEffect(() => {
    if (query.isSuccess) {
      if (query.data) setAuth(query.data);
      else setLoggedOut();
    }

    if (query.isError) {
      setLoggedOut();
    }
  }, [query.data, query.isError, query.isSuccess, setAuth, setLoggedOut]);

  return query;
}
