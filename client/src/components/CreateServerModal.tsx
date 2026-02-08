import { type ChangeEvent, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertServerSchema } from '@shared/schema';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateServer, useUploadFile } from '@/hooks/use-chat';
import { Plus, Upload, Loader2 } from 'lucide-react';
import { z } from 'zod';

const formSchema = insertServerSchema.extend({
  name: z.string().min(1, "Server name is required"),
  iconUrl: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function CreateServerModal() {
  const [open, setOpen] = useState(false);
  const createServer = useCreateServer();
  const uploadFile = useUploadFile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      iconUrl: undefined,
    }
  });

  const iconUrl = watch("iconUrl");

  const handleIconUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    try {
      const { url } = await uploadFile.mutateAsync(file);
      setValue("iconUrl", url, { shouldDirty: true });
    } catch {
      // Errors are handled by the mutation toast
    }
  };

  const onSubmit = (data: FormValues) => {
    createServer.mutate({ ...data, iconUrl: data.iconUrl || undefined }, {
      onSuccess: () => {
        setOpen(false);
        reset();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button 
          className="w-12 h-12 rounded-[24px] hover:rounded-[16px] transition-all duration-300 bg-card/50 hover:bg-green-500/20 text-green-500 flex items-center justify-center group mb-2 border border-dashed border-green-500/30 hover:border-green-500"
          aria-label="Create Server"
        >
          <Plus size={24} className="group-hover:scale-110 transition-transform duration-200" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border/50 text-foreground">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display text-center mb-2">Customize your server</DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Give your new server a personality with a name and an icon. You can always change it later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-4">
          <div className="flex justify-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleIconUpload}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-24 h-24 rounded-full bg-muted border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-xs text-muted-foreground cursor-pointer hover:bg-muted/80 transition-colors overflow-hidden"
              aria-label="Upload server icon"
              disabled={uploadFile.isPending}
            >
              {iconUrl ? (
                <img src={iconUrl} alt="Server icon" className="w-full h-full object-cover" />
              ) : (
                <>
                  {uploadFile.isPending ? (
                    <Loader2 className="mb-1 opacity-70 animate-spin" size={24} />
                  ) : (
                    <Upload className="mb-1 opacity-50" size={24} />
                  )}
                  <span>Upload</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs uppercase font-bold text-muted-foreground">Server Name</Label>
            <Input 
              id="name" 
              {...register('name')} 
              className="bg-background/50 border-input focus:ring-primary/50"
              placeholder="My awesome server"
            />
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <DialogFooter className="sm:justify-between flex-row bg-muted/30 -mx-6 -mb-6 p-6 mt-6">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Back</Button>
            <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" disabled={createServer.isPending}>
              {createServer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
