import { useState, useMemo, useRef, useEffect } from 'react';

/**
 * usePagination — slice a full dataset into pages.
 *
 * @param items       The full sorted+filtered array
 * @param pageSize    How many items to show per page (default 10)
 * @param initialPages How many pages to show initially (default 1)
 */
export function usePagination<T>(items: T[], pageSize = 10, initialPages = 1) {
  const [pages, setPages] = useState(initialPages);

  // Reset to initial when the underlying array identity changes (new search, new data load)
  const prevLenRef = useRef(items.length);
  useEffect(() => {
    if (items.length !== prevLenRef.current) {
      setPages(initialPages);
      prevLenRef.current = items.length;
    }
  }, [items.length, initialPages]);

  const visible = useMemo(() => items.slice(0, pages * pageSize), [items, pages, pageSize]);
  const hasMore = visible.length < items.length;

  const loadMore = () => setPages(p => p + 1);
  const reset = () => setPages(initialPages);

  return { visible, hasMore, loadMore, reset, total: items.length, showing: visible.length };
}
