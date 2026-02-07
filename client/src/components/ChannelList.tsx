import { useParams, Link } from "wouter";
import { useServer, useChannels } from "@/hooks/use-chat";
import { Hash, Volume2, Settings, Mic, Headphones } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/hooks/use-auth";
import { CreateChannelModal } from "./CreateChannelModal";

export function ChannelList() {
  const params = useParams();
  const serverId = Number(params.serverId);
  const channelId = Number(params.channelId);
  const user = useAuthStore(state => state.user);

  const { data: server, isLoading: isServerLoading } = useServer(serverId);
  const { data: channels, isLoading: isChannelsLoading } = useChannels(serverId);

  if (isServerLoading) return <div className="w-60 bg-card h-full flex items-center justify-center">Loading...</div>;
  if (!server) return null;

  const textChannels = channels?.filter(c => c.type === 'text') || [];
  const voiceChannels = channels?.filter(c => c.type === 'voice') || [];

  return (
    <div className="w-60 bg-card/95 h-full flex flex-col border-r border-border/40">
      {/* Server Header */}
      <div className="h-12 px-4 flex items-center shadow-sm border-b border-border/40 hover:bg-white/5 transition-colors cursor-pointer">
        <h2 className="font-display font-bold text-foreground truncate">{server.name}</h2>
      </div>

      <ScrollArea className="flex-1 px-2 py-3">
        {/* Text Channels */}
        <div className="mb-4">
          <div className="flex items-center justify-between px-2 mb-1 group">
            <h3 className="text-xs font-bold text-muted-foreground uppercase group-hover:text-foreground transition-colors">Text Channels</h3>
            <CreateChannelModal serverId={serverId} />
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
            <CreateChannelModal serverId={serverId} />
          </div>
           <div className="space-y-[2px]">
            {voiceChannels.map((channel) => (
              <div 
                key={channel.id} 
                className={`flex items-center px-2 py-1.5 rounded-md group cursor-pointer transition-all duration-200 text-muted-foreground hover:bg-muted hover:text-foreground`}
              >
                <Volume2 size={18} className="mr-1.5 opacity-70" />
                <span className="truncate font-medium text-sm">{channel.name}</span>
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>

      {/* User Controls */}
      <div className="bg-[#0b1212]/50 p-2 flex items-center justify-between border-t border-border/40">
        <div className="flex items-center gap-2 hover:bg-white/5 p-1 rounded cursor-pointer transition-colors max-w-[120px]">
          <Avatar className="h-8 w-8 border border-white/10">
            <AvatarImage src={user?.avatarUrl || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">{user?.displayName?.substring(0,2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="overflow-hidden">
            <div className="text-xs font-bold truncate text-foreground">{user?.displayName}</div>
            <div className="text-[10px] truncate text-muted-foreground">#{user?.username.substring(0, 4)}</div>
          </div>
        </div>
        <div className="flex items-center">
          <button className="p-1.5 hover:bg-white/10 rounded text-muted-foreground hover:text-foreground transition-colors">
            <Mic size={18} />
          </button>
          <button className="p-1.5 hover:bg-white/10 rounded text-muted-foreground hover:text-foreground transition-colors">
            <Headphones size={18} />
          </button>
          <button className="p-1.5 hover:bg-white/10 rounded text-muted-foreground hover:text-foreground transition-colors">
            <Settings size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
