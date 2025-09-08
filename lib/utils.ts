import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// This check can be removed, it is just for tutorial purposes
export const hasEnvVars =
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY;

export function timeToMs(timeStr: string): number {
    const regex = /^(\d{1,2}):(\d{2}):(\d{2})(?:\.(\d{1,2}))?$/;
    const match = timeStr.match(regex);
  
    if (!match) {
      throw new Error("Invalid time format. Use hh:mm:ss.aa");
    }
  
    const [, hh, mm, ss, aa] = match;
    const hours = parseInt(hh, 10);
    const minutes = parseInt(mm, 10);
    const seconds = parseInt(ss, 10);
    const centiseconds = aa ? parseInt(aa, 10) : 0; // 0.01秒単位
  
    return (
      hours * 3600 * 1000 +
      minutes * 60 * 1000 +
      seconds * 1000 +
      centiseconds * 10
    );
}
