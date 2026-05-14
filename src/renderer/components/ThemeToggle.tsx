import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from './ui/button';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <Button
      variant="outline"
      size="icon"
      className="rounded-xl h-10 w-10 border-border/80 bg-card hover:bg-accent transition-all duration-300"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {isDark ? (
        <Sun size={18} className="text-amber-300 animate-in zoom-in duration-300" />
      ) : (
        <Moon size={18} className="text-slate-600 animate-in zoom-in duration-300" />
      )}
    </Button>
  );
}
