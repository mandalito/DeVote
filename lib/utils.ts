import { type ClassValue } from 'clsx';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortId(id: string, n = 6) {
  return id.length <= n ? id : `${id.slice(0, n)}…`;
}

export function fmtTime(ms: number) {
  const d = new Date(ms);
  return d.toLocaleString();
}
