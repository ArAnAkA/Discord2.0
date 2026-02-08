import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { useChannels, useMessages, useSendMessage, useUploadFile } from "@/hooks/use-chat";
import { Hash, Plus, Gift, Smile, Sticker, Send, FileIcon, X, Download, ImageIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { type ProfileUser, UserProfileModal } from "@/components/UserProfileModal";

export function ChatArea() {
  const params = useParams();
  const serverId = Number(params.serverId);
  const channelId = Number(params.channelId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: channels } = useChannels(serverId);
  const { data: messages, isLoading } = useMessages(channelId);
  const sendMessageMutation = useSendMessage();
  const uploadFileMutation = useUploadFile();
  
  const currentChannel = channels?.find(c => c.id === channelId);
  
  const [messageInput, setMessageInput] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
  const { toast } = useToast();

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    const content = messageInput.trim();
    if (!content) return;

    setMessageInput("");

    try {
      await sendMessageMutation.mutateAsync({
        channelId,
        content
      });
    } catch (error) {
      console.error("Failed to send message:", error);
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
      setMessageInput(content);
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const { url } = await uploadFileMutation.mutateAsync(file);
      await sendMessageMutation.mutateAsync({
        channelId,
        attachmentUrl: url
      });
    } catch (error) {
      console.error("Upload failed:", error);
      toast({ title: "Error", description: "Upload failed", variant: "destructive" });
    }
  };

  if (!channelId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground">
        <div className="bg-card/50 p-8 rounded-2xl border border-border/50 text-center max-w-md">
           <h3 className="text-xl font-display font-bold text-foreground mb-2">No Channel Selected</h3>
           <p>Pick a channel from the sidebar to start chatting.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
      
      {/* Channel Header */}
      <div className="h-12 px-4 flex items-center border-b border-border/40 shadow-sm z-10 bg-background/80 backdrop-blur-md">
        <Hash className="text-muted-foreground mr-2" size={20} />
        <h3 className="font-bold text-foreground">{currentChannel?.name}</h3>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 custom-scrollbar" ref={scrollRef}>
        {!isLoading && messages?.length === 0 && (
          <div className="flex flex-col items-start justify-end min-h-[50vh] pb-8">
             <div className="h-16 w-16 bg-card rounded-full flex items-center justify-center mb-4">
               <Hash size={40} className="text-primary" />
             </div>
             <h2 className="text-3xl font-bold font-display mb-2">Welcome to #{currentChannel?.name}!</h2>
             <p className="text-muted-foreground">This is the start of the #{currentChannel?.name} channel.</p>
          </div>
        )}
      
        {messages?.map((msg, i) => {
          const prevMsg = messages[i-1];
          const isSameUser = prevMsg && prevMsg.userId === msg.userId;
          // Simple heuristic for grouping: same user and less than 5 mins apart
          const isGrouped = isSameUser && (new Date(msg.createdAt!).getTime() - new Date(prevMsg.createdAt!).getTime() < 5 * 60 * 1000);

          const isImage = msg.attachmentUrl?.match(/\.(jpg|jpeg|png|gif|webp)$/i);

          return (
            <div key={msg.id} className={`flex group ${isGrouped ? 'mt-1' : 'mt-6'}`}>
               {!isGrouped ? (
                  <Avatar
                    className="h-10 w-10 mr-4 border border-white/5 cursor-pointer hover:drop-shadow-lg transition-all mt-0.5"
                    onClick={() => {
                      if (!msg.sender) return;
                      setProfileUser({
                        id: msg.sender.id,
                        username: msg.sender.username,
                        displayName: msg.sender.displayName,
                        avatarUrl: msg.sender.avatarUrl ?? null,
                      });
                      setProfileOpen(true);
                    }}
                  >
                     <AvatarImage src={msg.sender?.avatarUrl || undefined} />
                     <AvatarFallback className="bg-secondary text-secondary-foreground">
                      {(msg.sender?.username?.slice(0, 2) || "??").toUpperCase()}
                     </AvatarFallback>
                  </Avatar>
                ) : (
                 <div className="w-10 mr-4 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 flex justify-center pt-1 select-none">
                   {format(new Date(msg.createdAt!), 'h:mm aa')}
                 </div>
               )}

               <div className="flex-1 min-w-0">
                  {!isGrouped && (
                    <div className="flex items-center gap-2 mb-1">
                       <span className="font-bold text-foreground hover:underline cursor-pointer">{msg.sender?.displayName}</span>
                       <span className="text-xs text-muted-foreground">{format(new Date(msg.createdAt!), 'MM/dd/yyyy h:mm aa')}</span>
                    </div>
                  )}
                  {msg.content && (
                    <p className={`text-base text-foreground/90 whitespace-pre-wrap leading-relaxed`}>
                      {msg.content}
                    </p>
                  )}
                  {msg.attachmentUrl && (
                    <div className="mt-2">
                      {isImage ? (
                        <div className="relative group/image max-w-sm rounded-lg overflow-hidden border border-border/50">
                          <img src={msg.attachmentUrl} alt="attachment" className="max-h-80 w-auto object-contain bg-card/50" />
                          <a 
                            href={msg.attachmentUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="absolute top-2 right-2 p-1.5 bg-background/80 backdrop-blur-sm rounded-md opacity-0 group-hover/image:opacity-100 transition-opacity hover:bg-primary hover:text-primary-foreground"
                          >
                            <Download size={16} />
                          </a>
                        </div>
                      ) : (
                        <div className="flex items-center p-3 bg-card rounded-lg border border-border/50 max-w-sm group/file">
                          <div className="h-10 w-10 bg-primary/10 rounded flex items-center justify-center text-primary mr-3">
                            <FileIcon size={24} />
                          </div>
                          <div className="flex-1 min-w-0 mr-3">
                            <p className="text-sm font-medium text-foreground truncate">{msg.attachmentUrl.split('-').slice(2).join('-') || 'File'}</p>
                            <p className="text-xs text-muted-foreground uppercase">Attachment</p>
                          </div>
                          <a 
                            href={msg.attachmentUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="p-2 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Download size={20} />
                          </a>
                        </div>
                      )}
                    </div>
                  )}
               </div>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      <div className="px-4 pb-6 pt-2 z-10 bg-background">
        <div className="bg-card/80 rounded-lg p-2.5 flex items-start shadow-lg ring-1 ring-white/5 focus-within:ring-primary/50 transition-all">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-white/10 transition-colors mr-2 self-start mt-0.5"
          >
            <Plus size={20} className="bg-foreground rounded-full text-card p-0.5" />
          </button>
          
          <form className="flex-1 max-h-60 overflow-y-auto" onSubmit={handleSendMessage}>
             <Input 
                className="bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-2 py-2 h-auto text-foreground placeholder:text-muted-foreground/60 min-h-[44px]"
                placeholder={`Message #${currentChannel?.name || 'channel'}`}
                value={messageInput}
                onChange={e => setMessageInput(e.target.value)}
                autoComplete="off"
             />
          </form>

          <div className="flex items-center gap-1 self-start mt-0.5 ml-2">
             <button
               type="button"
               onClick={() => toast({ title: "Not implemented", description: "Gifts are not available yet." })}
               className="p-2 text-muted-foreground hover:text-primary transition-colors hover:bg-white/5 rounded"
             >
                <Gift size={20} />
             </button>
             <button
               type="button"
               onClick={() => toast({ title: "Not implemented", description: "Stickers are not available yet." })}
               className="p-2 text-muted-foreground hover:text-primary transition-colors hover:bg-white/5 rounded"
             >
                <Sticker size={20} />
             </button>
             <button
               type="button"
               onClick={() => toast({ title: "Not implemented", description: "Emoji picker is not available yet." })}
               className="p-2 text-muted-foreground hover:text-primary transition-colors hover:bg-white/5 rounded"
             >
                <Smile size={20} />
             </button>
             {(messageInput.trim().length > 0 || uploadFileMutation.isPending) && (
                <button 
                  type="button"
                  onClick={() => void sendMessage()}
                  disabled={uploadFileMutation.isPending}
                  className="p-2 text-primary hover:text-primary-foreground hover:bg-primary transition-colors rounded disabled:opacity-50"
                >
                  <Send size={20} />
                </button>
             )}
          </div>
        </div>
      </div>

      <UserProfileModal open={profileOpen} onOpenChange={setProfileOpen} user={profileUser} />
    </div>
  );
}
