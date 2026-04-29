import React from 'react';
import { Loader2, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

/** Shown at the bottom of a paginated list */
export function LoadMoreButton({
  hasMore,
  onLoadMore,
  showing,
  total,
  label = '10',
  className,
}: {
  hasMore: boolean;
  onLoadMore: () => void;
  showing: number;
  total: number;
  label?: string;
  className?: string;
}) {
  if (!hasMore) {
    return total > 0 ? (
      <p className={cn('text-center text-xs text-muted-foreground py-3', className)}>
        Showing all {total.toLocaleString()} items
      </p>
    ) : null;
  }
  return (
    <div className={cn('flex flex-col items-center gap-1 py-4', className)}>
      <Button
        variant="outline"
        size="sm"
        onClick={onLoadMore}
        className="gap-2 text-xs font-semibold shadow-sm hover:shadow-md transition-all"
      >
        <ChevronDown size={14} />
        Load {label} More
      </Button>
      <p className="text-[10px] text-muted-foreground">
        Showing {showing.toLocaleString()} of {total.toLocaleString()}
      </p>
    </div>
  );
}

/** Inline search spinner shown while debounce delay fires */
export function SearchSpinner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
      <Loader2 size={15} className="animate-spin text-primary opacity-70" />
    </div>
  );
}
