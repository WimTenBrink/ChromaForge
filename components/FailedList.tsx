import React from 'react';
import { RefreshCw, Trash2, AlertTriangle, Ban, Search } from 'lucide-react';
import { FailedItem } from '../types';

interface Props {
  failedItems: FailedItem[];
  onRetry: (item: FailedItem) => void;
  onRetryAll: () => void;
  onDelete: (id: string) => void;
  onZoom: (data: { url: string, title: string, metadata: string }) => void;
}

const FailedList: React.FC<Props> = ({ failedItems, onRetry, onRetryAll, onDelete, onZoom }) => {
  const retryableCount = failedItems.filter(f => f.retryCount < 5).length;

  return (
    <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center">
        <h2 className="font-bold text-red-400">Failed Jobs</h2>
        {retryableCount > 0 && (
            <button 
                onClick={onRetryAll}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded flex items-center gap-1 transition-colors"
            >
                <RefreshCw size={12} /> Retry All ({retryableCount})
            </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
         {failedItems.length === 0 ? (
          <div className="text-center text-slate-600 text-sm mt-10 italic">
            No failures.
          </div>
        ) : (
            failedItems.map(item => {
                const canRetry = item.retryCount < 5;
                return (
                    <div key={item.id} className="bg-slate-800/50 border border-red-900/30 rounded-lg overflow-hidden group">
                        {/* Full Width Image Thumbnail */}
                        <div 
                            className="w-full aspect-square bg-slate-950 relative border-b border-slate-800 cursor-zoom-in"
                            onClick={() => onZoom({
                                url: item.sourceImagePreview,
                                title: "Failed Source Image",
                                metadata: item.error
                            })}
                        >
                            <img 
                                src={item.sourceImagePreview} 
                                className="w-full h-full object-cover opacity-60 grayscale" 
                                alt="source" 
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:hidden">
                                <AlertTriangle className="text-red-500/50 w-12 h-12" />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-opacity">
                                <Search className="text-white" size={24} />
                            </div>
                        </div>

                        <div className="p-3">
                            <p className="text-xs text-red-300 font-mono leading-tight mb-2 break-words line-clamp-3 bg-red-950/30 p-1.5 rounded border border-red-900/20">
                                {item.error}
                            </p>
                            <p className="text-[10px] text-slate-500 truncate mb-3" title={item.optionsSummary}>
                                {item.optionsSummary}
                            </p>
                            
                            <div className="flex items-center justify-between gap-2">
                                <span className={`text-[10px] font-bold ${canRetry ? 'text-amber-500' : 'text-red-500'}`}>
                                    Failures: {item.retryCount}/5
                                </span>
                                <div className="flex gap-2">
                                    <button 
                                        onClick={() => onRetry(item)}
                                        disabled={!canRetry}
                                        className={`px-3 py-1 rounded text-xs flex items-center justify-center gap-1 transition-colors ${
                                            canRetry 
                                            ? 'bg-slate-700 hover:bg-slate-600 text-slate-200' 
                                            : 'bg-slate-800 text-slate-600 cursor-not-allowed'
                                        }`}
                                        title={canRetry ? "Retry this job" : "Retry limit reached"}
                                    >
                                        {canRetry ? <RefreshCw size={12} /> : <Ban size={12} />} 
                                    </button>
                                    <button 
                                        onClick={() => onDelete(item.id)}
                                        className="px-2 bg-slate-700 hover:bg-red-900/50 text-slate-400 hover:text-red-300 py-1 rounded transition-colors"
                                        title="Dismiss"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })
        )}
      </div>
    </div>
  );
};

export default FailedList;