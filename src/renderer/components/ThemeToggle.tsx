import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { Button } from './ui/button';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="outline"
      size="icon"
      className="rounded-full h-10 w-10 border-border bg-background hover:bg-accent transition-all duration-300"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {theme === 'dark' ? (
        <Sun size={18} className="text-orange-300 animate-in zoom-in spin-in-90 duration-500" />
      ) : (
        <Moon size={18} className="text-slate-600 animate-in zoom-in spin-in-90 duration-500" />
      )}
    </Button>
  );
}
