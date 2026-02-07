import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useAuthStore } from "./use-auth";
import type { InsertUser } from "@shared/schema";

// Type definitions for hook usage
type ServerInput = { name: string; iconUrl?: string };
type ChannelInput = { name: string; type: 'text' | 'voice' };

// Utility to get headers
const getHeaders = () => {
  const token = useAuthStore.getState().token;
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : '',
  };
};

// --- SERVERS ---

export function useServers() {
  return useQuery({
    queryKey: [api.servers.list.path],
    queryFn: async () => {
      const res = await fetch(api.servers.list.path, { headers: getHeaders() });
      if (!res.ok) throw new Error("Failed to fetch servers");
      return await res.json();
    },
    enabled: !!useAuthStore.getState().token,
  });
}

export function useServer(id: number) {
  return useQuery({
    queryKey: [api.servers.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.servers.get.path, { id });
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) throw new Error("Failed to fetch server details");
      return await res.json();
    },
    enabled: !!id && !!useAuthStore.getState().token,
  });
}

export function useCreateServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: ServerInput) => {
      const res = await fetch(api.servers.create.path, {
        method: api.servers.create.method,
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create server");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.servers.list.path] });
    },
  });
}

// --- CHANNELS ---

export function useChannels(serverId: number) {
  return useQuery({
    queryKey: [api.channels.list.path, serverId],
    queryFn: async () => {
      const url = buildUrl(api.channels.list.path, { serverId });
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) throw new Error("Failed to fetch channels");
      return await res.json();
    },
    enabled: !!serverId && !!useAuthStore.getState().token,
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ serverId, ...data }: ChannelInput & { serverId: number }) => {
      const url = buildUrl(api.channels.create.path, { serverId });
      const res = await fetch(url, {
        method: api.channels.create.method,
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create channel");
      return await res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.servers.get.path, variables.serverId] });
      queryClient.invalidateQueries({ queryKey: [api.channels.list.path, variables.serverId] });
    },
  });
}

// --- MESSAGES ---

export function useMessages(channelId: number) {
  return useQuery({
    queryKey: [api.channels.messages.path, channelId],
    queryFn: async () => {
      const url = buildUrl(api.channels.messages.path, { channelId });
      const res = await fetch(url, { headers: getHeaders() });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return await res.json();
    },
    enabled: !!channelId && !!useAuthStore.getState().token,
    refetchInterval: 3000, // Simple polling for now
  });
}

// --- FILE UPLOAD ---

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ channelId, content, attachmentUrl }: { channelId: number, content?: string, attachmentUrl?: string }) => {
      const res = await fetch(`/api/channels/${channelId}/messages`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ content, attachmentUrl }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return await res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.channels.messages.path, variables.channelId] });
    },
  });
}

export function useUploadFile() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const token = useAuthStore.getState().token;
      const res = await fetch(api.upload.create.path, {
        method: api.upload.create.method,
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData,
      });
      
      if (!res.ok) throw new Error("Upload failed");
      return await res.json();
    }
  });
}
