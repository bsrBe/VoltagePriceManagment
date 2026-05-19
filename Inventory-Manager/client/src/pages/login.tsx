import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, User } from "lucide-react";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [registerRole, setRegisterRole] = useState<"worker" | "admin">("worker");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState("");
  const { role, login, addUser } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (role !== null) setLocation("/");
  }, [role, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "login") {
      const success = await login(username, password);
      if (!success) setError("Invalid credentials");
    } else {
      const success = await addUser(username, password, registerRole);
      if (success) {
        await login(username, password);
      } else {
        setError("Username already exists or registration failed");
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background/95 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] opacity-50 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[128px] opacity-50 pointer-events-none" />

      <Card className="w-full max-w-md border-white/10 bg-card/50 backdrop-blur-xl shadow-2xl relative z-10">
        <CardHeader className="space-y-3 text-center pb-8">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-2">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">ProductFlow</CardTitle>
          <CardDescription className="text-muted-foreground">
            {mode === "login" ? "Enter your credentials to access the system" : "Create a new account"}
          </CardDescription>
          {/* Mode toggle */}
          <div className="flex rounded-lg border border-white/10 p-1 gap-1">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); setShowAdvanced(false); setRegisterRole("worker"); }}
              className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${mode === "login" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setError(""); }}
              className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${mode === "register" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Register
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                    <User className="h-4 w-4" />
                  </div>
                  <Input
                    id="username"
                    placeholder="Enter username"
                    className="pl-10 bg-black/20 border-white/10 focus-visible:ring-primary h-12"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                    <Lock className="h-4 w-4" />
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10 bg-black/20 border-white/10 focus-visible:ring-primary h-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            {mode === "register" && (
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                >
                  {showAdvanced ? "▾" : "▸"} Advanced
                </button>
                {showAdvanced && (
                  <div className="flex gap-2 pl-3">
                    {(["worker", "admin"] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setRegisterRole(r)}
                        className={`px-3 py-1 text-xs rounded-md border transition-colors capitalize ${registerRole === r ? "border-primary text-primary" : "border-white/10 text-muted-foreground hover:border-white/30"}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <Button type="submit" className="w-full h-12 text-lg font-medium">
              {mode === "login" ? "Sign In" : "Create Account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}