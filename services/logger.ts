import { LogEntry, LogLevel } from "../types";

let listeners: ((entry: LogEntry) => void)[] = [];

export const log = (level: LogLevel, title: string, details: any) => {
  const entry: LogEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    level,
    title,
    details,
  };
  
  // Notify listeners
  listeners.forEach(l => l(entry));
  
  // Also log to browser console for dev
  if (level === 'ERROR') {
    console.error(`[${title}]`, details);
  } else {
    console.log(`[${title}]`, details);
  }
};

export const subscribeToLogs = (callback: (entry: LogEntry) => void) => {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
};