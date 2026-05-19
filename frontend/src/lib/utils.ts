import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string, chars = 6): string {
  if (!address) return "";
  return `${address.slice(0, chars)}...${address.slice(-chars + 2)}`;
}

export function formatEth(wei: string | number | bigint | undefined | null): string {
  if (wei === undefined || wei === null || wei === "") return "0.00";
  try {
    const weiValue = BigInt(wei);
    const ethValue = Number(weiValue) / 1e18;
    return ethValue.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    });
  } catch {
    return "0.00";
  }
}

export function formatNumber(num: number | undefined | null): string {
  if (num == null || num === undefined) return "0";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return num.toLocaleString();
}

export function getRiskColor(score: number): string {
  if (score >= 90) return "text-cyber-neon-red";
  if (score >= 70) return "text-cyber-neon-orange";
  if (score >= 50) return "text-cyber-neon-yellow";
  return "text-cyber-neon-green";
}

export function getRiskBgColor(score: number): string {
  if (score >= 90) return "bg-cyber-neon-red/20 border-cyber-neon-red/50";
  if (score >= 70) return "bg-cyber-neon-orange/20 border-cyber-neon-orange/50";
  if (score >= 50) return "bg-cyber-neon-yellow/20 border-cyber-neon-yellow/50";
  return "bg-cyber-neon-green/20 border-cyber-neon-green/50";
}

export function getRiskLevel(score: number): string {
  if (score >= 90) return "CRITICAL";
  if (score >= 70) return "HIGH";
  if (score >= 50) return "MEDIUM";
  return "LOW";
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "active":
      return "text-cyber-neon-green bg-cyber-neon-green/20 border-cyber-neon-green/50";
    case "under_review":
      return "text-cyber-neon-yellow bg-cyber-neon-yellow/20 border-cyber-neon-yellow/50";
    case "suspended":
      return "text-cyber-neon-orange bg-cyber-neon-orange/20 border-cyber-neon-orange/50";
    case "frozen":
      return "text-cyber-neon-red bg-cyber-neon-red/20 border-cyber-neon-red/50";
    default:
      return "text-cyber-text-muted bg-cyber-bg-card border-cyber-border";
  }
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
