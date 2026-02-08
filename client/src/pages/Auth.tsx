import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";
import { useLogin, useRegister, useAuthStore, useMe } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Separate schemas for Login and Register
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = insertUserSchema.extend({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [, setLocation] = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isInitialized = useAuthStore((s) => s.isInitialized);
  const { isLoading: isLoadingMe } = useMe();
  
  const loginMutation = useLogin();
  const registerMutation = useRegister();

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/app");
    }
  }, [isAuthenticated, setLocation]);

  if (!isInitialized || isLoadingMe) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-center relative">
      {/* Dark overlay with Aurora tint */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
      
      <Card className="w-full max-w-md relative z-10 bg-[#1a2323]/90 border-white/5 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in duration-300">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-display font-bold text-white mb-2 tracking-tight">Aurora</h1>
            <p className="text-muted-foreground">
              {isLogin ? "Welcome back! We're so excited to see you again!" : "Create an account to join the community."}
            </p>
          </div>

          {isLogin ? (
            <LoginForm 
              onSubmit={(data) => loginMutation.mutate(data, { onSuccess: () => setLocation('/app') })} 
              isLoading={loginMutation.isPending}
            />
          ) : (
            <RegisterForm 
              onSubmit={(data) => registerMutation.mutate(data, { onSuccess: () => setLocation('/app') })}
              isLoading={registerMutation.isPending}
            />
          )}

          <div className="mt-6 text-sm text-muted-foreground text-center">
            {isLogin ? (
              <>
                Need an account?{" "}
                <button 
                  onClick={() => setIsLogin(false)} 
                  className="text-primary hover:underline font-semibold focus:outline-none"
                >
                  Register
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button 
                  onClick={() => setIsLogin(true)} 
                  className="text-primary hover:underline font-semibold focus:outline-none"
                >
                  Log In
                </button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoginForm({ onSubmit, isLoading }: { onSubmit: (data: any) => void, isLoading: boolean }) {
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema)
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="username">USERNAME</Label>
        <Input 
          id="username" 
          {...register("username")} 
          className="bg-background/50 border-input/50 focus:ring-primary/50" 
        />
        {errors.username && <p className="text-xs text-red-500 font-bold mt-1">{(errors.username.message as string)}</p>}
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="password">PASSWORD</Label>
        <Input 
          id="password" 
          type="password" 
          {...register("password")} 
          className="bg-background/50 border-input/50 focus:ring-primary/50" 
        />
        {errors.password && <p className="text-xs text-red-500 font-bold mt-1">{(errors.password.message as string)}</p>}
        <button
          type="button"
          onClick={() => toast({ title: "Not implemented", description: "Password recovery is not available yet." })}
          className="text-xs text-primary hover:underline cursor-pointer text-left"
        >
          Forgot your password?
        </button>
      </div>

      <Button type="submit" className="w-full bg-primary hover:bg-primary/80 text-primary-foreground font-bold mt-4" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Log In
      </Button>
    </form>
  );
}

function RegisterForm({ onSubmit, isLoading }: { onSubmit: (data: any) => void, isLoading: boolean }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema)
  });

  // Filter out confirmPassword before sending to API
  const onFormSubmit = (data: any) => {
    const { confirmPassword, ...rest } = data;
    onSubmit(rest);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="displayName">DISPLAY NAME</Label>
        <Input 
          id="displayName" 
          {...register("displayName")} 
          className="bg-background/50 border-input/50 focus:ring-primary/50" 
        />
        {errors.displayName && <p className="text-xs text-red-500 font-bold mt-1">{(errors.displayName.message as string)}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">USERNAME</Label>
        <Input 
          id="username" 
          {...register("username")} 
          className="bg-background/50 border-input/50 focus:ring-primary/50" 
        />
        {errors.username && <p className="text-xs text-red-500 font-bold mt-1">{(errors.username.message as string)}</p>}
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="password">PASSWORD</Label>
          <Input 
            id="password" 
            type="password" 
            {...register("password")} 
            className="bg-background/50 border-input/50 focus:ring-primary/50" 
          />
          {errors.password && <p className="text-xs text-red-500 font-bold mt-1">{(errors.password.message as string)}</p>}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">CONFIRM</Label>
          <Input 
            id="confirmPassword" 
            type="password" 
            {...register("confirmPassword")} 
            className="bg-background/50 border-input/50 focus:ring-primary/50" 
          />
          {errors.confirmPassword && <p className="text-xs text-red-500 font-bold mt-1">{(errors.confirmPassword.message as string)}</p>}
        </div>
      </div>

      <Button type="submit" className="w-full bg-primary hover:bg-primary/80 text-primary-foreground font-bold mt-4" disabled={isLoading}>
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Continue
      </Button>
    </form>
  );
}
