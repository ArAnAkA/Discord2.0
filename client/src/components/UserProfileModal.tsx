import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type ProfileUser = {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export function UserProfileModal({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ProfileUser | null;
}) {
  const displayName = user?.displayName || "User";
  const initials = (displayName.slice(0, 2) || "U").toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-card border-border/50 text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Profile</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-4 pt-1">
          <Avatar className="h-20 w-20 border border-white/10">
            <AvatarImage src={user?.avatarUrl || undefined} />
            <AvatarFallback className="bg-primary/20 text-primary font-bold text-xl">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <div className="text-lg font-bold truncate">{displayName}</div>
            <div className="text-sm text-muted-foreground truncate">
              @{user?.username || "unknown"}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

