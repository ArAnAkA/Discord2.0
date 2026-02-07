import { Link, useLocation } from "wouter";
import { useServers } from "@/hooks/use-chat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CreateServerModal } from "./CreateServerModal";
import { Home } from "lucide-react";

export function ServerRail() {
  const [location] = useLocation();
  const { data: servers } = useServers();

  // Helper to check if active
  const isActive = (path: string) => location.startsWith(path);
  const isHome = location === '/app' || location === '/app/';

  return (
    <div className="w-[72px] bg-[#081010] h-full flex flex-col items-center py-3 overflow-y-auto no-scrollbar z-20 shadow-2xl">
      {/* Home Button */}
      <div className="mb-2 relative group w-full flex justify-center">
        {isHome && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-white rounded-r-full" />}
        {!isHome && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-2 bg-white rounded-r-full transition-all duration-200 group-hover:h-5 opacity-0 group-hover:opacity-100" />}
        
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Link href="/app">
              <div className={`w-12 h-12 rounded-[24px] ${isHome ? 'rounded-[16px] bg-primary text-white' : 'bg-card text-foreground hover:rounded-[16px] hover:bg-primary hover:text-white'} transition-all duration-200 flex items-center justify-center cursor-pointer shadow-lg`}>
                <Home size={28} />
              </div>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" className="bg-black text-white border-0 font-bold">
            Direct Messages
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="w-8 h-[2px] bg-white/10 rounded-full mb-2" />

      {/* Server List */}
      <div className="space-y-2 w-full flex flex-col items-center">
        {servers?.map((server) => {
          const active = location.includes(`/app/${server.id}`);
          return (
            <div key={server.id} className="relative group w-full flex justify-center">
              {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-10 bg-white rounded-r-full" />}
              {!active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-2 bg-white rounded-r-full transition-all duration-200 group-hover:h-5 opacity-0 group-hover:opacity-100" />}
              
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link href={`/app/${server.id}`}>
                    <div className={`w-12 h-12 rounded-[24px] ${active ? 'rounded-[16px] outline outline-2 outline-primary outline-offset-2' : 'hover:rounded-[16px] hover:bg-primary'} transition-all duration-200 cursor-pointer overflow-hidden bg-card group-hover:bg-primary`}>
                       {server.iconUrl ? (
                         <img src={server.iconUrl} alt={server.name} className="w-full h-full object-cover" />
                       ) : (
                         <div className="w-full h-full flex items-center justify-center font-bold text-sm text-foreground group-hover:text-white transition-colors">
                           {server.name.substring(0, 2).toUpperCase()}
                         </div>
                       )}
                    </div>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="bg-black text-white border-0 font-bold">
                  {server.name}
                </TooltipContent>
              </Tooltip>
            </div>
          );
        })}
      </div>

      <div className="w-8 h-[2px] bg-white/10 rounded-full my-2" />

      {/* Add Server Button */}
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <div><CreateServerModal /></div>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-black text-white border-0 font-bold">
          Add a Server
        </TooltipContent>
      </Tooltip>
      
    </div>
  );
}
