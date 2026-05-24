import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatInvoiceId(id: number | string, dateString?: string) {
  const d = dateString ? new Date(dateString) : new Date();
  const isValid = !isNaN(d.getTime());
  const datePart = isValid
    ? d.getFullYear().toString() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0')
    : new Date().getFullYear().toString() +
      String(new Date().getMonth() + 1).padStart(2, '0') +
      String(new Date().getDate()).padStart(2, '0');
  
  const numericId = Number(id);
  const idPart = Number.isFinite(numericId)
    ? String(Math.max(0, Math.trunc(numericId))).padStart(5, '0')
    : String(id ?? '').trim();
  return `INV-${datePart}-${idPart || '00000'}`;
}
