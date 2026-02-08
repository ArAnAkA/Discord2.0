import { type ChangeEvent, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore, useUpdateProfile } from "@/hooks/use-auth";
import { useUploadFile } from "@/hooks/use-chat";
import { Loader2, Upload } from "lucide-react";

const formSchema = z.object({
  displayName: z.string().min(1, "Display name is required"),
  avatarUrl: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function EditProfileModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const uploadFile = useUploadFile();
  const updateProfile = useUpdateProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      displayName: user?.displayName || "",
      avatarUrl: user?.avatarUrl || undefined,
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      displayName: user?.displayName || "",
      avatarUrl: user?.avatarUrl || undefined,
    });
  }, [open, reset, user?.avatarUrl, user?.displayName]);

  const avatarUrl = watch("avatarUrl") || user?.avatarUrl || undefined;
  const displayName = watch("displayName") || user?.displayName || "User";
  const initials = (displayName.slice(0, 2) || "U").toUpperCase();

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const { url } = await uploadFile.mutateAsync(file);
      setValue("avatarUrl", url, { shouldDirty: true });
    } catch {
      // handled by mutation toast
    }
  };

  const onSubmit = (values: FormValues) => {
    updateProfile.mutate(
      {
        displayName: values.displayName,
        avatarUrl: values.avatarUrl || undefined,
      },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border/50 text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Edit Profile</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-2">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar className="h-20 w-20 border border-white/10">
                <AvatarImage src={avatarUrl} />
                <AvatarFallback className="bg-primary/20 text-primary font-bold">{initials}</AvatarFallback>
              </Avatar>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="secondary"
                className="justify-start"
                disabled={uploadFile.isPending}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploadFile.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload avatar
              </Button>
              <div className="text-xs text-muted-foreground">PNG/JPG, up to 10MB</div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-xs uppercase font-bold text-muted-foreground">
              Display Name
            </Label>
            <Input id="displayName" {...register("displayName")} className="bg-background/50 border-input focus:ring-primary/50" />
            {errors.displayName && <p className="text-xs text-red-500">{errors.displayName.message}</p>}
          </div>

          <DialogFooter className="bg-muted/30 -mx-6 -mb-6 p-6 mt-6">
            <div className="flex justify-between w-full">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

