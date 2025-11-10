import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plane } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(2, "Full name must be at least 2 characters").optional(),
  code: z.string().length(4, "Code must be exactly 4 characters"),
});

const loginSchema = z.object({
  emailOrCode: z.string().min(1, "Email or code is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const Auth = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [loginData, setLoginData] = useState({ emailOrCode: "", password: "" });
  const [signupData, setSignupData] = useState({ email: "", password: "", fullName: "", code: "" });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      loginSchema.parse(loginData);
      
      let email = loginData.emailOrCode;
      
      // Check if input is a 4-letter code (case-insensitive)
      if (loginData.emailOrCode.length === 4 && /^[A-Za-z]{4}$/.test(loginData.emailOrCode)) {
        // Look up email by code
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("email")
          .eq("code", loginData.emailOrCode.toUpperCase())
          .single();

        if (profileError || !profileData) {
          toast.error("Invalid code or code not found");
          return;
        }

        email = profileData.email;
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: loginData.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data.user) {
        toast.success("Logged in successfully");
        navigate("/dashboard");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("An error occurred during login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validate code is exactly 4 letters
      if (signupData.code && (!/^[A-Za-z]{4}$/.test(signupData.code))) {
        toast.error("Code must be exactly 4 letters");
        return;
      }

      authSchema.parse(signupData);
      
      const { data, error } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            full_name: signupData.fullName,
            code: signupData.code.toUpperCase(),
          },
        },
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data.user) {
        toast.success("Account created successfully");
        navigate("/dashboard");
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("An error occurred during signup");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Plane className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">AIMS Flight Management</CardTitle>
          <CardDescription>
            Secure access for aviation operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email-or-code">Email or 4-Letter Code</Label>
                  <Input
                    id="login-email-or-code"
                    type="text"
                    placeholder="controller@aims.com or ABCD"
                    value={loginData.emailOrCode}
                    onChange={(e) => setLoginData({ ...loginData, emailOrCode: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Logging in..." : "Login"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="John Smith"
                    value={signupData.fullName}
                    onChange={(e) => setSignupData({ ...signupData, fullName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="controller@aims.com"
                    value={signupData.email}
                    onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-code">4-Letter Code</Label>
                  <Input
                    id="signup-code"
                    type="text"
                    placeholder="ABCD"
                    maxLength={4}
                    value={signupData.code}
                    onChange={(e) => setSignupData({ ...signupData, code: e.target.value.toUpperCase().replace(/[^A-Za-z]/g, '') })}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Choose a unique 4-letter code for quick login
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={signupData.password}
                    onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? "Creating account..." : "Create Account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
