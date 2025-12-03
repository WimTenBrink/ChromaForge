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
  const logMethod = level === 'ERROR' ? console.error : console.log;
  
  let formattedDetails = details;
  try {
      if (typeof details === 'object' && details !== null) {
          formattedDetails = JSON.stringify(details, null, 2);
      }
  } catch (e) {
      formattedDetails = '[Circular/Non-serializable]';
  }

  logMethod(`[${title}]`, formattedDetails);
};

export const subscribeToLogs = (callback: (entry: LogEntry) => void) => {
  listeners.push(callback);
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
};