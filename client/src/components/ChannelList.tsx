import { useState } from "react";
import { useParams, Link } from "wouter";
import { useServer, useChannels } from "@/hooks/use-chat";
import { Hash, Volume2, Settings, Mic, MicOff, Headphones, LogOut, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore, useLogout } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useVoiceStore } from "@/hooks/use-voice";
import { CreateChannelModal } from "./CreateChannelModal";
import { EditProfileModal } from "./EditProfileModal";
import { InviteMemberModal } from "./InviteMemberModal";
import { RenameServerModal } from "./RenameServerModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ChannelList() {
  const params = useParams();
  const serverId = Number(params.serverId);
  const channelId = Number(params.channelId);
  const user = useAuthStore(state => state.user);
  const { toast } = useToast();
  const logoutMutation = useLogout();
  const micMuted = useVoiceStore((s) => s.micMuted);
  const toggleMicMuted = useVoiceStore((s) => s.toggleMicMuted);
  const deafened = useVoiceStore((s) => s.deafened);
  const toggleDeafened = useVoiceStore((s) => s.toggleDeafened);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const { data: server, isLoading: isServerLoading } = useServer(serverId);
  const { data: channels, isLoading: isChannelsLoading } = useChannels(serverId);

  if (isServerLoading) return <div className="w-60 bg-card h-full flex items-center justify-center">Loading...</div>;
  if (!server) return null;

  const textChannels = channels?.filter(c => c.type === 'text') || [];
  const voiceChannels = channels?.filter(c => c.type === 'voice') || [];

  const myRole = server.members?.find((m) => m.id === user?.id)?.role;
  const canManageServer = myRole === "owner" || myRole === "admin";
  const canInvite = canManageServer;
  const canManageChannels = canManageServer;

  const displayName = user?.displayName || "User";
  const username = user?.username || "user";
  const userInitials = (displayName.slice(0, 2) || "U").toUpperCase();

  return (
    <div className="w-60 bg-card/95 h-full flex flex-col border-r border-border/40">
      {/* Server Header */}
      <div className="h-12 px-4 flex items-center shadow-sm border-b border-border/40 hover:bg-white/5 transition-colors cursor-pointer">
        <h2 className="font-display font-bold text-foreground truncate">{server.name}</h2>
        <div className="ml-auto flex items-center gap-2">
          {canInvite && <InviteMemberModal serverId={serverId} />}
          {canManageServer && <RenameServerModal serverId={serverId} currentName={server.name} />}
        </div>
      </div>

      <ScrollArea className="flex-1 px-2 py-3">
        {/* Text Channels */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-2 mb-1 group">
            <h3 className="text-xs font-bold text-muted-foreground uppercase group-hover:text-foreground transition-colors">Text Channels</h3>
            {canManageChannels && <CreateChannelModal serverId={serverId} />}
          </div>
          <div className="space-y-[2px]">
            {textChannels.map((channel) => (
              <Link 
                key={channel.id} 
                href={`/app/${serverId}/${channel.id}`}
                className={`flex items-center px-2 py-1.5 rounded-md group transition-all duration-200 ${channel.id === channelId ? 'bg-primary/20 text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                <Hash size={18} className="mr-1.5 opacity-70" />
                <span className="truncate font-medium text-sm">{channel.name}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Voice Channels */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-2 mb-1 group">
            <h3 className="text-xs font-bold text-muted-foreground uppercase group-hover:text-foreground transition-colors">Voice Channels</h3>
            {canManageChannels && <CreateChannelModal serverId={serverId} />}
          </div>
           <div className="space-y-[2px]">
            {voiceChannels.map((channel) => (
              <Link
                key={channel.id} 
                href={`/app/${serverId}/${channel.id}`}
                className={`flex items-center px-2 py-1.5 rounded-md group transition-all duration-200 ${channel.id === channelId ? 'bg-primary/20 text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              >
                <Volume2 size={18} className="mr-1.5 opacity-70" />
                <span className="truncate font-medium text-sm">{channel.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* User Controls */}
      <div className="bg-[#0b1212]/50 p-2 flex items-center justify-between border-t border-border/40">
        <div className="flex items-center gap-2 hover:bg-white/5 p-1 rounded cursor-pointer transition-colors max-w-[120px]">
          <Avatar className="h-8 w-8 border border-white/10">
            <AvatarImage src={user?.avatarUrl || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">{userInitials}</AvatarFallback>
          </Avatar>
          <div className="overflow-hidden">
            <div className="text-xs font-bold truncate text-foreground">{displayName}</div>
            <div className="text-[10px] truncate text-muted-foreground">@{username}</div>
          </div>
        </div>
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => {
              const next = !micMuted;
              toggleMicMuted();
              toast({ title: next ? "Mic muted" : "Mic unmuted" });
            }}
            className={`p-1.5 hover:bg-white/10 rounded transition-colors ${micMuted ? "text-red-400 hover:text-red-300" : "text-muted-foreground hover:text-foreground"}`}
            aria-label="Toggle microphone mute"
          >
            {micMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !deafened;
              toggleDeafened();
              toast({ title: next ? "Deafened" : "Undeafened" });
            }}
            className={`p-1.5 hover:bg-white/10 rounded transition-colors ${deafened ? "text-yellow-400 hover:text-yellow-300" : "text-muted-foreground hover:text-foreground"}`}
            aria-label="Toggle headphone (deafen)"
          >
            <Headphones size={18} />
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-1.5 hover:bg-white/10 rounded text-muted-foreground hover:text-foreground transition-colors"
                aria-label="User menu"
              >
                <Settings size={18} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-56">
              <DropdownMenuLabel className="truncate">{displayName}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setIsProfileOpen(true)}>
                <User />
                Edit profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={logoutMutation.isPending}
                onSelect={() => logoutMutation.mutate()}
              >
                <LogOut />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <EditProfileModal open={isProfileOpen} onOpenChange={setIsProfileOpen} />
    </div>
  );
}
