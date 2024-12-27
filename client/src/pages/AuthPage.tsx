import { useState } from "react";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { useUser } from "../hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { SiGoogle, SiFacebook } from "react-icons/si";

const loginSchema = z.object({
  username: z.string().min(1, "Username or email is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().default(false),
});

const registerSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be less than 20 characters"),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

export default function AuthPage() {
  const { login, register } = useUser();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
      rememberMe: false,
    },
  });

  const registerForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
    },
  });

  const handleLogin = async (data: z.infer<typeof loginSchema>) => {
    try {
      const result = await login(data);
      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.message,
        });
      } else {
        setLocation("/"); // Redirect to home after successful login
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    }
  };

  const handleRegister = async (data: z.infer<typeof registerSchema>) => {
    try {
      const result = await register(data);
      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "Error",
          description: result.message,
        });
      } else {
        setLocation("/onboarding"); // Redirect to onboarding after successful registration
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "An unexpected error occurred",
      });
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      toast({
        title: "Success",
        description: "If an account exists with this email, you will receive password reset instructions.",
      });
      setIsResettingPassword(false);
      setResetEmail("");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send reset email",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Welcome to LinguaQuest</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              {!isResettingPassword ? (
                <>
                  <Form {...loginForm}>
                    <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                      <div className="space-y-2">
                        <Input
                          placeholder="Username or Email"
                          {...loginForm.register("username")}
                        />
                        {loginForm.formState.errors.username && (
                          <p className="text-sm text-red-500">{loginForm.formState.errors.username.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Input
                          type="password"
                          placeholder="Password"
                          {...loginForm.register("password")}
                        />
                        {loginForm.formState.errors.password && (
                          <p className="text-sm text-red-500">{loginForm.formState.errors.password.message}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="rememberMe"
                          {...loginForm.register("rememberMe")}
                        />
                        <label
                          htmlFor="rememberMe"
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          Remember me
                        </label>
                      </div>
                      <Button type="submit" className="w-full">
                        Login
                      </Button>
                      <div className="text-center">
                        <button
                          type="button"
                          onClick={() => setIsResettingPassword(true)}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                          <span className="px-2 bg-background text-muted-foreground">
                            Or continue with
                          </span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => window.location.href = "/api/auth/google"}
                          className="w-full"
                        >
                          <SiGoogle className="mr-2" />
                          Google
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => window.location.href = "/api/auth/facebook"}
                          className="w-full"
                        >
                          <SiFacebook className="mr-2" />
                          Facebook
                        </Button>
                      </div>
                    </form>
                  </Form>
                </>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">Reset Password</h3>
                  <form onSubmit={handlePasswordReset} className="space-y-4">
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                    />
                    <Button type="submit" className="w-full">
                      Send Reset Link
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full"
                      onClick={() => setIsResettingPassword(false)}
                    >
                      Back to Login
                    </Button>
                  </form>
                </div>
              )}
            </TabsContent>
            <TabsContent value="register">
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(handleRegister)} className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      placeholder="Username"
                      {...registerForm.register("username")}
                    />
                    {registerForm.formState.errors.username && (
                      <p className="text-sm text-red-500">{registerForm.formState.errors.username.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="email"
                      placeholder="Email"
                      {...registerForm.register("email")}
                    />
                    {registerForm.formState.errors.email && (
                      <p className="text-sm text-red-500">{registerForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="password"
                      placeholder="Password"
                      {...registerForm.register("password")}
                    />
                    {registerForm.formState.errors.password && (
                      <p className="text-sm text-red-500">{registerForm.formState.errors.password.message}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full">
                    Register
                  </Button>
                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-background text-muted-foreground">
                        Or register with
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => window.location.href = "/api/auth/google"}
                      className="w-full"
                    >
                      <SiGoogle className="mr-2" />
                      Google
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => window.location.href = "/api/auth/facebook"}
                      className="w-full"
                    >
                      <SiFacebook className="mr-2" />
                      Facebook
                    </Button>
                  </div>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}