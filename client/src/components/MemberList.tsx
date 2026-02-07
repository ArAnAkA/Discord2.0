import { useServer } from "@/hooks/use-chat";
import { useParams } from "wouter";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function MemberList() {
  const { serverId } = useParams();
  const { data: server } = useServer(Number(serverId));

  if (!server) return null;

  // Group members by online status (mocked for now since schema doesn't fully track RT status yet)
  const onlineMembers = server.members?.filter(m => m.online) || [];
  const offlineMembers = server.members?.filter(m => !m.online) || [];

  return (
    <div className="w-60 hidden lg:flex bg-card/40 h-full flex-col border-l border-border/40">
      <ScrollArea className="flex-1 px-3 py-4">
        
        {/* Online Category */}
        <div className="mb-6">
          <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2 px-2">Online — {onlineMembers.length}</h3>
          <div className="space-y-1">
            {onlineMembers.map((member) => (
              <div key={member.id} className="flex items-center px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer group opacity-100 transition-colors">
                 <div className="relative mr-3">
                   <Avatar className="h-8 w-8">
                     <AvatarImage src={member.avatarUrl || undefined} />
                     <AvatarFallback className="bg-primary/20 text-primary">{member.displayName.substring(0,2).toUpperCase()}</AvatarFallback>
                   </Avatar>
                   <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-background rounded-full flex items-center justify-center">
                     <div className="w-2.5 h-2.5 bg-green-500 rounded-full" />
                   </div>
                 </div>
                 <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-foreground group-hover:text-white truncate">
                      {member.displayName}
                    </div>
                    {/* Optional Status Message */}
                 </div>
              </div>
            ))}
            {/* Mock Data for visual fullness if empty */}
            {onlineMembers.length === 0 && (
               <div className="px-2 text-xs text-muted-foreground italic">No one is online.</div>
            )}
          </div>
        </div>

        {/* Offline Category */}
        <div>
          <h3 className="text-xs font-bold text-muted-foreground uppercase mb-2 px-2">Offline — {offlineMembers.length}</h3>
          <div className="space-y-1">
            {offlineMembers.map((member) => (
              <div key={member.id} className="flex items-center px-2 py-1.5 rounded hover:bg-white/5 cursor-pointer group opacity-60 hover:opacity-100 transition-all">
                 <div className="relative mr-3">
                   <Avatar className="h-8 w-8 grayscale group-hover:grayscale-0 transition-all">
                     <AvatarImage src={member.avatarUrl || undefined} />
                     <AvatarFallback>{member.displayName.substring(0,2).toUpperCase()}</AvatarFallback>
                   </Avatar>
                   <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-background rounded-full flex items-center justify-center">
                     <div className="w-2.5 h-2.5 border-2 border-muted-foreground rounded-full" />
                   </div>
                 </div>
                 <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-foreground truncate">
                      {member.displayName}
                    </div>
                 </div>
              </div>
            ))}
          </div>
        </div>

      </ScrollArea>
    </div>
  );
}
