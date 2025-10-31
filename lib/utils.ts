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

export function formatTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);

  if (hours > 0) {
    // 時間あり → 01:23:45
    return `${String(hours)}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  } else {
    // 時間なし → 23:45
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
}

export function getOneYearAgoDateFormatted(): string {
  const today = new Date();
  today.setFullYear(today.getFullYear() - 1);

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
