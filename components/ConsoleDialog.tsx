import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Terminal, Activity, Image as ImageIcon, Server, AlertCircle } from 'lucide-react';
import { LogEntry, LogLevel } from '../types';
import { subscribeToLogs } from '../services/logger';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const ConsoleDialog: React.FC<Props> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'INFO' | 'GEMINI' | 'IMAGEN' | 'ERROR'>('ALL');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = subscribeToLogs((entry) => {
      setLogs(prev => [...prev, entry]);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen, activeTab]);

  if (!isOpen) return null;

  const filteredLogs = logs.filter(log => {
    if (activeTab === 'ALL') return true;
    if (activeTab === 'INFO') return log.level === 'INFO';
    if (activeTab === 'ERROR') return log.level === 'ERROR' || log.level === 'WARN';
    if (activeTab === 'GEMINI') return log.level.startsWith('GEMINI');
    if (activeTab === 'IMAGEN') return log.level.startsWith('IMAGEN'); // Placeholder if we used Imagen
    return true;
  });

  const safeStringify = (obj: any) => {
      try {
          return JSON.stringify(obj, (key, value) => {
            if (value instanceof Error) {
                return {
                    name: value.name,
                    message: value.message,
                    stack: value.stack,
                    ...(value as any)
                };
            }
            return value;
          }, 2);
      } catch (e) {
          return `[Unable to stringify object: ${(e as Error).message}]`;
      }
  };

  const copyToClipboard = (entry: LogEntry) => {
    const text = `[${new Date(entry.timestamp).toISOString()}] [${entry.level}] ${entry.title}\n${safeStringify(entry.details)}`;
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-[90vw] h-[90vh] bg-slate-900 border border-slate-700 rounded-xl flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900 rounded-t-xl">
          <div className="flex items-center gap-2 text-slate-100 font-mono font-bold">
            <Terminal size={20} className="text-emerald-500" />
            <span>System Console</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700 bg-slate-900">
            {[
                { id: 'ALL', label: 'All Logs', icon: Terminal },
                { id: 'INFO', label: 'Info', icon: Activity },
                { id: 'GEMINI', label: 'Gemini', icon: Server },
                { id: 'IMAGEN', label: 'Imagen', icon: ImageIcon },
                { id: 'ERROR', label: 'Errors', icon: AlertCircle },
            ].map((tab: any) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors border-b-2 ${
                        activeTab === tab.id 
                        ? 'border-emerald-500 text-emerald-400 bg-slate-800' 
                        : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                >
                    <tab.icon size={16} />
                    {tab.label}
                </button>
            ))}
        </div>

        {/* Log Content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950 font-mono text-xs">
            {filteredLogs.length === 0 ? (
                <div className="text-slate-600 italic text-center py-10">No logs for this category yet.</div>
            ) : (
                filteredLogs.map(log => (
                    <div key={log.id} className="group border border-slate-800 bg-slate-900 rounded p-3 hover:border-slate-600 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <div className="flex gap-2 items-center">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    log.level === 'ERROR' ? 'bg-red-900 text-red-200' :
                                    log.level === 'WARN' ? 'bg-amber-900 text-amber-200' :
                                    log.level.includes('REQ') ? 'bg-blue-900 text-blue-200' :
                                    log.level.includes('RES') ? 'bg-purple-900 text-purple-200' :
                                    'bg-slate-700 text-slate-200'
                                }`}>
                                    {log.level}
                                </span>
                                <span className="text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                <span className="text-emerald-400 font-bold">{log.title}</span>
                            </div>
                            <button onClick={() => copyToClipboard(log)} className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white transition-opacity">
                                <Copy size={14} />
                            </button>
                        </div>
                        <details className="mt-1">
                            <summary className="cursor-pointer text-slate-400 hover:text-slate-200 select-none">View Details</summary>
                            <pre className="mt-2 p-2 bg-black rounded text-slate-300 overflow-x-auto border border-slate-800">
                                {safeStringify(log.details)}
                            </pre>
                        </details>
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  );
};

export default ConsoleDialog;