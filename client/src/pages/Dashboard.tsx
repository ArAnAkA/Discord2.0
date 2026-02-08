import { useEffect } from "react";
import { useLocation, Route, Switch, Redirect } from "wouter";
import { useAuthStore, useMe } from "@/hooks/use-auth";
import { ServerRail } from "@/components/ServerRail";
import { ChannelList } from "@/components/ChannelList";
import { ChannelMain } from "@/components/ChannelMain";
import { MemberList } from "@/components/MemberList";
import { Loader2 } from "lucide-react";
import { connectSocket } from "@/lib/socket";

export default function Dashboard() {
  const [location, setLocation] = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const { data: user, isLoading: isLoadingMe } = useMe();

  useEffect(() => {
    if (location.length > 1 && location.endsWith("/")) {
      setLocation(location.slice(0, -1));
    }
  }, [location, setLocation]);

  useEffect(() => {
    if (isInitialized && isAuthenticated) {
      connectSocket();
    }
  }, [isAuthenticated, isInitialized]);

  if (!isInitialized || isLoadingMe) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Redirect to="/" />;
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden text-foreground">
      {/* 1. Server Rail (Leftmost) */}
      <ServerRail />

      <Switch>
        {/* Route: /app (Home/DM view - simplified for MVP) */}
        <Route path="/app">
          <div className="flex-1 flex bg-[#2f3136] items-center justify-center">
             <div className="text-center p-8">
               <h2 className="text-2xl font-bold mb-4">Welcome to Aurora</h2>
               <p className="text-muted-foreground">Select a server from the left rail to start chatting.</p>
             </div>
          </div>
        </Route>
        
        {/* Route: /app/:serverId (Server View) */}
        <Route path="/app/:serverId">
           {/* Needs channel list + empty chat state */}
           <ChannelList />
           <div className="flex-1 flex flex-col bg-background/50 items-center justify-center">
             <div className="text-muted-foreground">Select a channel</div>
           </div>
           <MemberList />
        </Route>

        {/* Route: /app/:serverId/:channelId (Full Chat View) */}
        <Route path="/app/:serverId/:channelId">
           <ChannelList />
           <ChannelMain />
           <MemberList />
        </Route>
      </Switch>
    </div>
  );
}
