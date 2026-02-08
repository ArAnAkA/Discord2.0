import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus } from "lucide-react";
import { useInviteToServer } from "@/hooks/use-chat";

const formSchema = z.object({
  username: z.string().min(1, "Username is required"),
});

type FormValues = z.infer<typeof formSchema>;

export function InviteMemberModal({ serverId }: { serverId: number }) {
  const [open, setOpen] = useState(false);
  const inviteMutation = useInviteToServer();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { username: "" },
  });

  const onSubmit = ({ username }: FormValues) => {
    inviteMutation.mutate(
      { serverId, username: username.trim() },
      {
        onSuccess: () => {
          setOpen(false);
          reset();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Invite user"
        >
          <UserPlus size={16} />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border/50 text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Invite to server</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="username" className="text-xs uppercase font-bold text-muted-foreground">
              Username 
            </Label>
            <Input
              id="username"
              {...register("username")}
              className="bg-background/50 border-input focus:ring-primary/50"
              placeholder="@username"
              autoComplete="off"
            />
            {errors.username && <p className="text-xs text-red-500">{errors.username.message}</p>}
            <p className="text-xs text-muted-foreground">
              Приглашение работает по <span className="font-semibold">@username</span> (логин). Можно вставлять как <span className="font-semibold">@Username</span> так и просто <span className="font-semibold">Username</span>.
            </p>
          </div>

          <DialogFooter className="bg-muted/30 -mx-6 -mb-6 p-6 mt-6">
            <div className="flex justify-between w-full">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Invite
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
