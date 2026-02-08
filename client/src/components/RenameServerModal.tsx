import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil } from "lucide-react";
import { useUpdateServer } from "@/hooks/use-chat";

const formSchema = z.object({
  name: z.string().min(1, "Server name is required"),
});

type FormValues = z.infer<typeof formSchema>;

export function RenameServerModal({ serverId, currentName }: { serverId: number; currentName: string }) {
  const [open, setOpen] = useState(false);
  const updateServer = useUpdateServer();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: currentName },
  });

  const onSubmit = ({ name }: FormValues) => {
    updateServer.mutate(
      { serverId, name: name.trim() },
      {
        onSuccess: () => {
          setOpen(false);
          reset({ name: name.trim() });
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset({ name: currentName });
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Rename server"
        >
          <Pencil size={16} />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border/50 text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Rename Server</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs uppercase font-bold text-muted-foreground">
              Server name
            </Label>
            <Input
              id="name"
              {...register("name")}
              className="bg-background/50 border-input focus:ring-primary/50"
              placeholder="Server name"
              autoComplete="off"
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <DialogFooter className="bg-muted/30 -mx-6 -mb-6 p-6 mt-6">
            <div className="flex justify-between w-full">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                disabled={updateServer.isPending}
              >
                {updateServer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

