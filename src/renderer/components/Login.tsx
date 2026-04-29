import React, { useState } from 'react';
import { ShieldCheck, Eye, EyeOff, LogIn, Store } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';

interface LoginProps {
  onAuthenticated: () => void;
}

export default function Login({ onAuthenticated }: LoginProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoData, setLogoData] = useState<string | null>(null);

  React.useEffect(() => {
    async function fetchLogo() {
      if (window.api && window.api.getLogo) {
        try {
          const res = await window.api.getLogo();
          if (res.success && res.data) {
            setLogoData(res.data);
          }
        } catch (e) {
          console.error("Failed to load dynamic logo", e);
        }
      }
    }
    fetchLogo();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Check if window.api exists
      if (!window.api) {
        console.error('window.api is undefined!');
        setError('Application not ready. Please restart.');
        return;
      }

      const response = await window.api.verifyPassword(password);

      // Handle both possible return types
      let isValid = false;
      if (typeof response === 'boolean') {
        isValid = response;
      } else if (response && typeof response === 'object' && 'success' in response) {
        isValid = response.success ? (response.data?.isValid || false) : false;
      }

      if (isValid) {
        onAuthenticated();
      } else {
        setError('Incorrect password. Please try again.');
        setPassword('');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-background transition-colors duration-1000">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-primary/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[100px] animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-purple-500/10 blur-[100px] animate-pulse" style={{ animationDuration: '12s' }} />
      </div>

      <div className="w-full max-w-md z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-24 mb-6 rounded-2xl bg-card/10 backdrop-blur-xl border border-border/50 shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            {logoData ? (
              <img src={logoData} alt="Logo" className="w-16 h-16 object-contain drop-shadow-lg" />
            ) : (
              <Store size={48} className="text-primary drop-shadow-[0_0_15px_rgba(var(--primary),0.5)]" />
            )}
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 transition-colors">Welcome Back</h1>
          <p className="text-muted-foreground transition-colors">Secure entry to your point of sale</p>
        </div>

        <Card className="bg-card/40 backdrop-blur-xl border-border/50 shadow-2xl text-foreground transition-all duration-300">
          <form onSubmit={handleSubmit}>
            <CardHeader className="space-y-1 pb-6">
              <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">Login</CardTitle>
              <CardDescription className="text-muted-foreground">
                Enter your secure PIN to unlock the terminal.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="relative group">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoFocus
                    required
                    className="h-12 border-border/50 bg-background/50 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary focus-visible:border-primary transition-all pr-12 text-lg tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/20 border border-destructive/30 text-destructive-foreground text-sm font-medium animate-in fade-in slide-in-from-top-2">
                  {error}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button
                type="submit"
                disabled={loading || !password}
                className="w-full h-12 text-base font-semibold transition-all duration-300 hover:scale-[1.02] shadow-[0_0_20px_rgba(var(--primary),0.3)] hover:shadow-[0_0_25px_rgba(var(--primary),0.5)]"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    <span>Verifying...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LogIn size={18} />
                    <span>Unlock Terminal</span>
                  </div>
                )}
              </Button>
              <p className="text-center text-xs text-muted-foreground transition-colors hover:text-foreground">
                <span className="font-mono text-primary bg-primary/10 px-2 py-0.5 rounded"></span>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}