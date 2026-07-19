import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getApiUrl(): string {
  // Server-side check
  if (typeof window === "undefined") {
    if (process.env.VERCEL || process.env.NODE_ENV === "production") {
      return "https://debt-proof-server1.onrender.com";
    }
    return process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
  }

  // Client-side browser check
  if (
    window.location.hostname === "debt-proof-client.vercel.app" ||
    window.location.hostname.endsWith(".vercel.app")
  ) {
    return "https://debt-proof-server1.onrender.com";
  }

  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
}
