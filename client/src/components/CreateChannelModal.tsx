import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCreateChannel } from '@/hooks/use-chat';
import { Plus, Hash, Volume2, Loader2 } from 'lucide-react';
import { z } from 'zod';

const formSchema = z.object({
  name: z.string().min(1, "Channel name is required").transform(val => val.toLowerCase().replace(/\s+/g, '-')),
  type: z.enum(["text", "voice"]),
});

type FormValues = z.infer<typeof formSchema>;

export function CreateChannelModal({ serverId }: { serverId: number }) {
  const [open, setOpen] = useState(false);
  const createChannel = useCreateChannel();
  
  const { register, handleSubmit, formState: { errors }, setValue, watch, reset } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "text",
    }
  });

  const selectedType = watch("type");

  const onSubmit = (data: FormValues) => {
    createChannel.mutate({ ...data, serverId }, {
      onSuccess: () => {
        setOpen(false);
        reset();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
         <button className="text-muted-foreground hover:text-foreground transition-colors">
            <Plus size={16} />
         </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border/50 text-foreground">
        <DialogHeader>
          <DialogTitle className="text-xl font-display">Create Channel</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-2">
          
          <div className="space-y-3">
            <Label className="text-xs uppercase font-bold text-muted-foreground">Channel Type</Label>
            <RadioGroup 
              defaultValue="text" 
              value={selectedType}
              onValueChange={(val) => setValue("type", val as "text" | "voice")}
              className="grid gap-2"
            >
              <div
                onClick={() => setValue("type", "text")}
                className={`flex items-center space-x-3 rounded-md border p-4 cursor-pointer hover:bg-muted/50 transition-colors ${selectedType === 'text' ? 'bg-muted/60 border-primary/50' : 'border-border'}`}
              >
                <RadioGroupItem value="text" id="text" className="sr-only" />
                <Hash className="text-muted-foreground" size={24} />
                <div className="flex-1">
                  <Label htmlFor="text" className="font-bold cursor-pointer">Text</Label>
                  <p className="text-xs text-muted-foreground">Send messages, images, and puns.</p>
                </div>
                <div className={`w-4 h-4 rounded-full border ${selectedType === 'text' ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                  {selectedType === 'text' && <div className="w-full h-full rounded-full bg-primary" />}
                </div>
              </div>

              <div
                onClick={() => setValue("type", "voice")}
                className={`flex items-center space-x-3 rounded-md border p-4 cursor-pointer hover:bg-muted/50 transition-colors ${selectedType === 'voice' ? 'bg-muted/60 border-primary/50' : 'border-border'}`}
              >
                <RadioGroupItem value="voice" id="voice" className="sr-only" />
                <Volume2 className="text-muted-foreground" size={24} />
                <div className="flex-1">
                  <Label htmlFor="voice" className="font-bold cursor-pointer">Voice</Label>
                  <p className="text-xs text-muted-foreground">Hang out together with voice.</p>
                </div>
                <div className={`w-4 h-4 rounded-full border ${selectedType === 'voice' ? 'border-primary bg-primary' : 'border-muted-foreground'}`}>
                   {selectedType === 'voice' && <div className="w-full h-full rounded-full bg-primary" />}
                </div>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-xs uppercase font-bold text-muted-foreground">Channel Name</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-muted-foreground">
                {selectedType === 'text' ? <Hash size={16} /> : <Volume2 size={16} />}
              </span>
              <Input 
                id="name" 
                {...register('name')} 
                className="pl-9 bg-background/50 border-input focus:ring-primary/50"
                placeholder="new-channel"
              />
            </div>
            {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <DialogFooter className="bg-muted/30 -mx-6 -mb-6 p-6 mt-6">
             <div className="flex justify-between w-full">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" disabled={createChannel.isPending}>
                  {createChannel.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Channel
                </Button>
             </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
