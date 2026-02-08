import { useParams } from "wouter";
import { useChannels } from "@/hooks/use-chat";
import { ChatArea } from "@/components/ChatArea";
import { VoiceArea } from "@/components/VoiceArea";
import { Loader2 } from "lucide-react";

export function ChannelMain() {
  const params = useParams();
  const serverId = Number(params.serverId);
  const channelId = Number(params.channelId);

  const { data: channels, isLoading } = useChannels(serverId);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  const current = channels?.find((c) => c.id === channelId);

  if (current?.type === "voice") return <VoiceArea />;
  return <ChatArea />;
}

