import React from 'react';
import { X, Copy, AlertTriangle, Terminal, Layers, Activity } from 'lucide-react';
import { Job, FailedItem, AppOptions } from '../types';

interface Props {
  job: Job | FailedItem | null;
  onClose: () => void;
}

const JobDetailDialog: React.FC<Props> = ({ job, onClose }) => {
  if (!job) return null;

  const isFailed = 'error' in job;
  const realJob = isFailed ? (job as FailedItem).originalJob : (job as Job);
  const prompt = realJob?.prompt || "Prompt not available";
  const options = realJob?.optionsSnapshot || {};
  const error = isFailed ? (job as FailedItem).error : null;
  const status = isFailed ? 'FAILED' : (job as Job).status;
  const id = job.id;

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
  };

  const renderOptions = () => {
    return Object.entries(options).map(([key, value]) => {
        if (!value) return null;
        if (Array.isArray(value) && value.length === 0) return null;
        if (key === 'combinedGroups') return null;
        
        return (
            <div key={key} className="mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase block">{key.replace(/([A-Z])/g, ' $1')}</span>
                <span className="text-sm text-slate-300">
                    {Array.isArray(value) ? value.join(', ') : String(value)}
                </span>
            </div>
        );
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[800px] max-w-[90vw] max-h-[85vh] bg-slate-900 border border-slate-700 rounded-xl flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950 rounded-t-xl">
             <div className="flex items-center gap-3">
                 {isFailed ? <AlertTriangle className="text-red-500" /> : <Layers className="text-blue-500" />}
                 <div>
                     <h3 className="font-bold text-lg text-white">Job Details</h3>
                     <p className="text-xs text-slate-400 font-mono">ID: {id}</p>
                 </div>
             </div>
             <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 bg-slate-900">
             {/* Status Banner */}
             <div className={`p-3 rounded-lg border flex items-center gap-3 ${isFailed ? 'bg-red-900/20 border-red-900/50 text-red-200' : 'bg-slate-800 border-slate-700 text-slate-200'}`}>
                 <Activity size={18} />
                 <div>
                     <span className="font-bold uppercase text-sm mr-2">Status:</span>
                     <span className="font-mono text-sm">{status}</span>
                     {isFailed && <span className="ml-2 text-xs opacity-70">(Retry: {(job as FailedItem).retryCount})</span>}
                 </div>
             </div>

             {isFailed && (
                 <div className="p-4 bg-black/40 border border-red-900/30 rounded-lg font-mono text-xs text-red-300 overflow-x-auto">
                     <strong className="block text-red-500 mb-1">Error Log:</strong>
                     {error}
                 </div>
             )}

             {/* Prompt Section */}
             <div>
                 <div className="flex items-center justify-between mb-2">
                     <h4 className="text-sm font-bold text-slate-400 uppercase flex items-center gap-2">
                         <Terminal size={14} /> System Prompt
                     </h4>
                     <button onClick={handleCopy} className="text-xs flex items-center gap-1 text-emerald-500 hover:text-emerald-400">
                         <Copy size={12} /> Copy
                     </button>
                 </div>
                 <div className="p-4 bg-black rounded-lg border border-slate-800 font-mono text-xs text-slate-400 whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">
                     {prompt}
                 </div>
             </div>

             {/* Options Section */}
             <div>
                 <h4 className="text-sm font-bold text-slate-400 uppercase mb-3 border-b border-slate-800 pb-1">Configuration Snapshot</h4>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                     {renderOptions()}
                 </div>
             </div>
        </div>
      </div>
    </div>
  );
};

export default JobDetailDialog;