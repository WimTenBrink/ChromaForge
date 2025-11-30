import React from 'react';
import { RefreshCw, Trash2, AlertTriangle } from 'lucide-react';
import { FailedItem } from '../types';

interface Props {
  failedItems: FailedItem[];
  onRetry: (item: FailedItem) => void;
  onRetryAll: () => void;
  onDelete: (id: string) => void;
}

const FailedList: React.FC<Props> = ({ failedItems, onRetry, onRetryAll, onDelete }) => {
  return (
    <div className="w-72 bg-slate-900 border-l border-slate-800 flex flex-col h-full">
      <div className="p-4 border-b border-slate-800 flex justify-between items-center">
        <h2 className="font-bold text-red-400">Failed Jobs</h2>
        {failedItems.length > 0 && (
            <button 
                onClick={onRetryAll}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-2 py-1 rounded flex items-center gap-1 transition-colors"
            >
                <RefreshCw size={12} /> Retry All
            </button>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
         {failedItems.length === 0 ? (
          <div className="text-center text-slate-600 text-sm mt-10 italic">
            No failures.
          </div>
        ) : (
            failedItems.map(item => (
                <div key={item.id} className="bg-slate-800/50 border border-red-900/30 rounded-lg p-3">
                    <div className="flex gap-3 mb-2">
                        <img 
                           src={item.sourceImagePreview} 
                           className="w-12 h-12 rounded object-cover border border-slate-700 opacity-50 grayscale" 
                           alt="source" 
                        />
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-red-300 font-mono leading-tight mb-1 break-words line-clamp-2">
                                {item.error}
                            </p>
                             <p className="text-[10px] text-slate-500 truncate">
                                {item.optionsSummary}
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => onRetry(item)}
                            className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-1 rounded text-xs flex items-center justify-center gap-1 transition-colors"
                        >
                            <RefreshCw size={12} /> Retry
                        </button>
                        <button 
                            onClick={() => onDelete(item.id)}
                            className="px-2 bg-slate-700 hover:bg-red-900/50 text-slate-400 hover:text-red-300 py-1 rounded transition-colors"
                        >
                            <Trash2 size={12} />
                        </button>
                    </div>
                </div>
            ))
        )}
      </div>
    </div>
  );
};

export default FailedList;