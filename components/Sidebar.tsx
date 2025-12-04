



import React, { useMemo, useState } from 'react';
import { Job, SourceImage, FailedItem, ValidationJob } from '../types';
import { Check, Trash2, RefreshCw, AlertTriangle, Ban, XCircle, Loader2, Layers, Image as ImageIcon, ScanSearch, RotateCcw } from 'lucide-react';

interface Props {
  jobs: Job[];
  validationQueue: ValidationJob[];
  sourceRegistry: Map<string, SourceImage>;
  failedItems: FailedItem[];
  selectedSourceIds: Set<string>;
  onToggleSource: (id: string) => void;
  onDeselectAll: () => void;
  onRetry: (item: FailedItem) => void;
  onRetryAll: (items: FailedItem[]) => void;
  onDeleteFailed: (id: string) => void;
  onDeleteJob: (id: string) => void;
  onDeleteSource: (id: string) => void;
}

type TabType = 'UPLOADS' | 'VALIDATING' | 'JOBS' | 'QUEUE' | 'FAILED' | 'PROHIBITED' | 'BLOCKED';

const Sidebar: React.FC<Props> = ({
  jobs,
  validationQueue,
  sourceRegistry,
  failedItems,
  selectedSourceIds,
  onToggleSource,
  onDeselectAll,
  onRetry,
  onRetryAll,
  onDeleteFailed,
  onDeleteJob,
  onDeleteSource
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('UPLOADS');

  // --- derived lists ---
  const uploads: SourceImage[] = Array.from(sourceRegistry.values());
  const processingJobs = jobs.filter(j => j.status === 'PROCESSING');
  const queuedJobs = jobs.filter(j => j.status === 'QUEUED');

  // Classification for failed items
  const { failed, prohibited, blocked } = useMemo(() => {
    const f: FailedItem[] = [];
    const p: FailedItem[] = [];
    const b: FailedItem[] = [];

    failedItems.forEach(item => {
      const isSafety = item.error.toLowerCase().includes('prohibited') || 
                       item.error.toLowerCase().includes('safety') ||
                       item.error.toLowerCase().includes('blocked');
      
      const maxRetries = isSafety ? 1 : 3;

      if (item.retryCount >= maxRetries) {
        b.push(item);
      } else if (isSafety) {
        p.push(item);
      } else {
        f.push(item);
      }
    });

    return { failed: f, prohibited: p, blocked: b };
  }, [failedItems]);

  const tabs: { id: TabType; label: string; icon: React.ElementType; count: number; color: string }[] = [
      { id: 'UPLOADS', label: 'Upload', icon: ImageIcon, count: uploads.length, color: 'text-emerald-400' },
      { id: 'VALIDATING', label: 'Check', icon: ScanSearch, count: validationQueue.length, color: 'text-purple-400' },
      { id: 'JOBS', label: 'Jobs', icon: Loader2, count: processingJobs.length, color: 'text-amber-400' },
      { id: 'QUEUE', label: 'Queue', icon: Layers, count: queuedJobs.length, color: 'text-blue-400' },
      { id: 'FAILED', label: 'Failed', icon: RefreshCw, count: failed.length, color: 'text-orange-400' },
      { id: 'PROHIBITED', label: 'Ban', icon: Ban, count: prohibited.length, color: 'text-red-500' },
      { id: 'BLOCKED', label: 'Dead', icon: XCircle, count: blocked.length, color: 'text-slate-500' },
  ];

  // Logic for green border on uploads
  const getUploadStatusClass = (sourceId: string) => {
      // Logic: 
      // 1. Must be READY (Validating done)
      // 2. No QUEUED or PROCESSING jobs for this source
      // 3. Must have had at least one job (or completed ones)
      // Actually simpler: if related jobs > 0 AND all related jobs are COMPLETED or FAILED/BLOCKED (none pending)
      
      const relatedJobs = jobs.filter(j => j.sourceImageId === sourceId);
      const active = relatedJobs.filter(j => j.status === 'QUEUED' || j.status === 'PROCESSING');
      
      // We also need to check if there are ANY active jobs in the main list. 
      // However, jobs[] passed prop usually contains pending/active. Completed are removed from jobs[].
      // So if active.length === 0, it means no active jobs for this source.
      
      // Also need to check validation queue
      const isValidating = validationQueue.some(v => v.sourceImageId === sourceId);
      if (isValidating) return '';

      // If no active jobs, and it exists in registry...
      // We want to highlight it ONLY if it actually finished a batch.
      // But since we delete completed jobs from the main jobs array, `active` will be 0.
      // We assume if it's in registry but not processing, it's done.
      if (active.length === 0 && !isValidating) {
          return 'border-4 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]';
      }
      return 'border border-slate-800';
  };

  // --- Render Helpers ---

  const renderCard = (
    imageUrl: string, 
    title: string, 
    subtitle: string, 
    actions: React.ReactNode, 
    overlay?: React.ReactNode,
    isSelected?: boolean,
    onSelect?: () => void,
    extraClasses?: string
  ) => (
    <div className={`relative group mb-4 flex flex-col ${extraClasses || ''}`}>
      <div className={`relative w-full bg-slate-900 rounded-lg overflow-hidden transition-all hover:shadow-md hover:border-slate-600 ${extraClasses ? '' : 'border border-slate-800'}`}>
        <img src={imageUrl} alt="thumbnail" className="w-full h-auto object-cover block opacity-80 group-hover:opacity-100 transition-opacity" />
        
        {/* Checkbox for Filtering */}
        {onSelect && (
            <div className="absolute top-2 left-2 z-20">
                <button 
                    onClick={(e) => { e.stopPropagation(); onSelect(); }}
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                        isSelected 
                        ? 'bg-emerald-500 border-emerald-500 text-white' 
                        : 'bg-black/40 border-white/30 text-transparent hover:border-white/70'
                    }`}
                >
                    <Check size={12} strokeWidth={4} />
                </button>
            </div>
        )}

        {/* Overlay Icon (Status) */}
        {overlay && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                {overlay}
            </div>
        )}

        {/* Filename Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-[2px] px-2 py-1.5 border-t border-white/10">
           <p className="text-[10px] text-white font-medium truncate">{title}</p>
        </div>

        {/* Actions (Top Right) */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
            {actions}
        </div>
      </div>
      
      {/* Options / Details Text */}
      <div className="mt-2 px-1">
          <p className="text-[10px] text-slate-400 leading-relaxed font-mono break-words">{subtitle}</p>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch(activeTab) {
        case 'UPLOADS':
            return (
                <div className="p-4">
                    {uploads.length === 0 && <p className="text-slate-600 text-xs italic text-center py-4">Drag images to upload</p>}
                    {uploads.map((src) => renderCard(
                        src.previewUrl, 
                        src.name, 
                        src.status === 'VALIDATING' ? 'Analyzing filename...' : `${src.type} • Source`,
                        <button onClick={() => onDeleteSource(src.id)} className="p-1.5 bg-black/60 hover:bg-red-600 text-white rounded transition-colors"><Trash2 size={12}/></button>,
                        src.status === 'VALIDATING' ? <Loader2 className="animate-spin text-purple-500" /> : null,
                        selectedSourceIds.has(src.id),
                        () => onToggleSource(src.id),
                        getUploadStatusClass(src.id)
                    ))}
                </div>
            );
        case 'VALIDATING':
            return (
                <div className="p-4">
                    {validationQueue.length === 0 && <p className="text-slate-700 text-xs italic text-center py-4">No images validating</p>}
                    {validationQueue.map(job => {
                        // Use local blob url from registry if available, else create temp? 
                        // Registry should have it.
                        const src = sourceRegistry.get(job.sourceImageId);
                        if (!src) return null;
                         return renderCard(
                            src.previewUrl,
                            "Analyzing...",
                            "Generating filename via AI...",
                            null,
                            <ScanSearch className="animate-pulse text-purple-400 w-8 h-8" />
                         )
                    })}
                </div>
            );
        case 'JOBS':
             return (
                <div className="p-4">
                    {processingJobs.length === 0 && <p className="text-slate-700 text-xs italic text-center py-4">No active jobs</p>}
                    {processingJobs.map(job => {
                        const src = sourceRegistry.get(job.sourceImageId);
                        if (!src) return null;
                        return renderCard(
                            src.previewUrl, 
                            job.originalFilename, 
                            job.optionsSummary, 
                            null,
                            <Loader2 className="animate-spin text-amber-500 w-8 h-8 drop-shadow-lg" />,
                            selectedSourceIds.has(job.sourceImageId),
                            () => onToggleSource(job.sourceImageId)
                        );
                    })}
                </div>
             );
        case 'QUEUE':
            return (
                <div className="p-4">
                    {queuedJobs.length === 0 && <p className="text-slate-700 text-xs italic text-center py-4">Queue empty</p>}
                    {queuedJobs.map(job => {
                        const src = sourceRegistry.get(job.sourceImageId);
                        if (!src) return null;
                        return renderCard(
                            src.previewUrl, 
                            job.originalFilename, 
                            job.optionsSummary,
                            <button onClick={() => onDeleteJob(job.id)} className="p-1.5 bg-black/60 hover:bg-slate-700 text-white rounded transition-colors"><XCircle size={12}/></button>,
                            <Layers className="text-blue-500/50 w-8 h-8" />,
                            selectedSourceIds.has(job.sourceImageId),
                            () => onToggleSource(job.sourceImageId)
                        );
                    })}
                </div>
            );
        case 'FAILED':
             return (
                <div className="p-4">
                    {failed.length > 0 && (
                        <button 
                            onClick={() => onRetryAll(failed)}
                            className="w-full mb-4 flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-orange-900/40 text-orange-400 hover:text-orange-200 border border-orange-900/50 rounded transition-colors text-xs font-bold uppercase tracking-wider"
                        >
                            <RotateCcw size={14} /> Retry All ({failed.length})
                        </button>
                    )}
                    {failed.length === 0 && <p className="text-slate-700 text-xs italic text-center py-4">No failed jobs</p>}
                    {failed.map(item => (
                        renderCard(
                            item.sourceImagePreview, 
                            `Failed: ${item.retryCount}/3`, 
                            `${item.error.substring(0, 100)}...`,
                            <div className="flex gap-1">
                                <button onClick={() => onRetry(item)} className="p-1.5 bg-black/60 hover:bg-emerald-600 text-white rounded"><RefreshCw size={12}/></button>
                                <button onClick={() => onDeleteFailed(item.id)} className="p-1.5 bg-black/60 hover:bg-slate-700 text-white rounded"><Trash2 size={12}/></button>
                            </div>,
                            <AlertTriangle className="text-orange-500 w-8 h-8" />,
                            selectedSourceIds.has(item.sourceImageId),
                            () => onToggleSource(item.sourceImageId)
                        )
                    ))}
                </div>
             );
        case 'PROHIBITED':
             return (
                <div className="p-4">
                     {prohibited.length > 0 && (
                        <button 
                            onClick={() => onRetryAll(prohibited)}
                            className="w-full mb-4 flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-red-900/40 text-red-400 hover:text-red-200 border border-red-900/50 rounded transition-colors text-xs font-bold uppercase tracking-wider"
                        >
                            <RotateCcw size={14} /> Retry All ({prohibited.length})
                        </button>
                    )}
                    {prohibited.length === 0 && <p className="text-slate-700 text-xs italic text-center py-4">No violations</p>}
                    {prohibited.map(item => (
                        renderCard(
                            item.sourceImagePreview, 
                            'Safety Violation', 
                            item.error,
                            <div className="flex gap-1">
                                {item.retryCount < 1 && (
                                    <button onClick={() => onRetry(item)} className="p-1.5 bg-black/60 hover:bg-emerald-600 text-white rounded"><RefreshCw size={12}/></button>
                                )}
                                <button onClick={() => onDeleteFailed(item.id)} className="p-1.5 bg-black/60 hover:bg-slate-700 text-white rounded"><Trash2 size={12}/></button>
                            </div>,
                            <Ban className="text-red-500 w-8 h-8" />,
                            selectedSourceIds.has(item.sourceImageId),
                            () => onToggleSource(item.sourceImageId)
                        )
                    ))}
                </div>
             );
        case 'BLOCKED':
             return (
                <div className="p-4">
                    {blocked.length === 0 && <p className="text-slate-700 text-xs italic text-center py-4">No blocked jobs</p>}
                    {blocked.map(item => (
                        renderCard(
                            item.sourceImagePreview, 
                            'Max Retries Exceeded', 
                            item.error,
                            <button onClick={() => onDeleteFailed(item.id)} className="p-1.5 bg-black/60 hover:bg-slate-700 text-white rounded"><Trash2 size={12}/></button>,
                            <XCircle className="text-slate-500 w-8 h-8" />,
                            selectedSourceIds.has(item.sourceImageId),
                            () => onToggleSource(item.sourceImageId)
                        )
                    ))}
                </div>
             );
    }
  };

  return (
    <div className="w-full h-full bg-slate-950 flex flex-col border-r border-slate-800">
        {/* Tab Navigation */}
        <div className="grid grid-cols-4 gap-0.5 p-1 bg-slate-900 border-b border-slate-800 shrink-0">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex flex-col items-center justify-center p-2 rounded transition-colors ${
                        activeTab === tab.id 
                        ? 'bg-slate-800 text-white' 
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                    }`}
                >
                    <div className="relative">
                        <tab.icon size={16} className={`mb-1 ${activeTab === tab.id ? tab.color : ''}`} />
                        {tab.count > 0 && (
                            <span className="absolute -top-1.5 -right-2 bg-slate-700 text-[9px] text-white px-1 rounded-full min-w-[14px] text-center border border-slate-900 font-bold">
                                {tab.count}
                            </span>
                        )}
                    </div>
                    <span className="text-[8px] uppercase tracking-wider font-bold">{tab.label}</span>
                </button>
            ))}
        </div>

        {/* Action Header for current tab */}
        <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center text-xs">
             <span className="text-slate-400 font-bold uppercase">{tabs.find(t => t.id === activeTab)?.label} List</span>
             {activeTab === 'UPLOADS' && selectedSourceIds.size > 0 && (
                <button onClick={onDeselectAll} className="text-[10px] text-emerald-400 hover:text-white flex items-center gap-1">
                    <XCircle size={10} /> Deselect All
                </button>
             )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-950">
            {renderTabContent()}
        </div>
    </div>
  );
};

export default Sidebar;