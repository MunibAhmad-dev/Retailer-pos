import { Link } from 'react-router-dom';
import { ShieldAlert, Key } from 'lucide-react';
import { Button } from './ui/button';
import { subService } from '../services/subscription';

interface Props {
  routeName: string;
  children: React.ReactNode;
}

export function ProtectedRoute({ routeName, children }: Props) {
  if (!subService.canAccess(routeName)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center animate-in fade-in zoom-in duration-300">
        <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mb-6">
          <ShieldAlert className="text-destructive h-10 w-10" />
        </div>
        <h1 className="text-3xl font-black tracking-tight mb-2 uppercase italic text-destructive">License Expired</h1>
        <p className="text-muted-foreground max-w-md mx-auto mb-8">
          Access to <span className="font-bold text-foreground">"{routeName.toUpperCase()}"</span> is currently restricted. Your subscription plan has ended.
        </p>
        
        <div className="flex gap-4">
           <Link to="/subscription">
             <Button className="gap-2 h-12 px-6">
               <Key size={18} /> Renew Subscription
             </Button>
           </Link>
           <Link to="/sales">
             <Button variant="outline" className="h-12 px-6">Go to Sales</Button>
           </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
