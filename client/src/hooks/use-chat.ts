import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { useAuthStore } from "./use-auth";
import type { Channel, Message, Server, User } from "@shared/schema";
import { useToast } from "./use-toast";

// Type definitions for hook usage
type ServerInput = { name: string; iconUrl?: string };
type ChannelInput = { name: string; type: 'text' | 'voice' };
type InviteInput = { serverId: number; username: string };
type UpdateServerInput = { serverId: number; name: string };

const jsonHeaders = { "Content-Type": "application/json" };

type PublicUser = Omit<User, "password">;
type ServerDetails = Server & { channels: Channel[]; members: (PublicUser & { role?: string | null })[] };
type MessageWithSender = Message & { sender: PublicUser };

// --- SERVERS ---

export function useServers() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<Server[]>({
    queryKey: [api.servers.list.path],
    queryFn: async () => {
      const res = await fetch(api.servers.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch servers");
      return (await res.json()) as Server[];
    },
    enabled: isAuthenticated,
  });
}

export function useServer(id: number) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<ServerDetails>({
    queryKey: [api.servers.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.servers.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch server details");
      return (await res.json()) as ServerDetails;
    },
    enabled: !!id && isAuthenticated,
  });
}

export function useCreateServer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: ServerInput) => {
      const res = await fetch(api.servers.create.path, {
        method: api.servers.create.method,
        headers: jsonHeaders,
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create server");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.servers.list.path] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUpdateServer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ serverId, name }: UpdateServerInput) => {
      const url = buildUrl(api.servers.update.path, { id: serverId });
      const res = await fetch(url, {
        method: api.servers.update.method,
        headers: jsonHeaders,
        body: JSON.stringify({ name }),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update server");
      }

      return await res.json();
    },
    onSuccess: (_server, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.servers.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.servers.get.path, variables.serverId] });
      toast({ title: "Saved", description: "Server updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

// --- CHANNELS ---

export function useChannels(serverId: number) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<Channel[]>({
    queryKey: [api.channels.list.path, serverId],
    queryFn: async () => {
      const url = buildUrl(api.channels.list.path, { serverId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch channels");
      return (await res.json()) as Channel[];
    },
    enabled: !!serverId && isAuthenticated,
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ serverId, ...data }: ChannelInput & { serverId: number }) => {
      const url = buildUrl(api.channels.create.path, { serverId });
      const res = await fetch(url, {
        method: api.channels.create.method,
        headers: jsonHeaders,
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create channel");
      return await res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.servers.get.path, variables.serverId] });
      queryClient.invalidateQueries({ queryKey: [api.channels.list.path, variables.serverId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

// --- MESSAGES ---

export function useMessages(channelId: number) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery<MessageWithSender[]>({
    queryKey: [api.channels.messages.path, channelId],
    queryFn: async () => {
      const url = buildUrl(api.channels.messages.path, { channelId });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return (await res.json()) as MessageWithSender[];
    },
    enabled: !!channelId && isAuthenticated,
    refetchInterval: 3000, // Simple polling for now
  });
}

// --- FILE UPLOAD ---

export function useSendMessage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ channelId, content, attachmentUrl }: { channelId: number, content?: string, attachmentUrl?: string }) => {
      const res = await fetch(`/api/channels/${channelId}/messages`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ content, attachmentUrl }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to send message");
      return await res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.channels.messages.path, variables.channelId] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

export function useUploadFile() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch(api.upload.create.path, {
        method: api.upload.create.method,
        body: formData,
        credentials: "include",
      });
      
      if (!res.ok) throw new Error("Upload failed");
      return await res.json();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}

// --- INVITES ---

export function useInviteToServer() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ serverId, username }: InviteInput) => {
      const url = buildUrl(api.servers.invite.path, { id: serverId });
      const res = await fetch(url, {
        method: api.servers.invite.method,
        headers: jsonHeaders,
        body: JSON.stringify({ username }),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to invite user");
      }

      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Invite", description: "User added to this server." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
