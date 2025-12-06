import React, { useMemo, useState } from 'react';
import { Job, SourceImage, FailedItem, ValidationJob, GeneratedImage, SidebarTab } from '../types';
import { Check, Trash2, RefreshCw, AlertTriangle, XCircle, Loader2, Layers, ScanSearch, RotateCcw, Eraser, Filter, AlertCircle, Ban } from 'lucide-react';

interface Props {
  activeTab: SidebarTab;
  jobs: Job[];
  validationQueue: ValidationJob[];
  sourceRegistry: Map<string, SourceImage>;
  failedItems: FailedItem[];
  selectedSourceIds: Set<string>;
  generatedImages: GeneratedImage[];
  onToggleSource: (id: string) => void;
  onDeselectAll: () => void;
  onRetry: (item: FailedItem) => void;
  onRetryAll: (items: FailedItem[]) => void;
  onRetrySource: (id: string) => void;
  onDeleteFailed: (id: string) => void;
  onDeleteJob: (id: string) => void;
  onDeleteSource: (id: string) => void;
  onDeleteAllBlocked: (items: FailedItem[]) => void;
  onViewJob?: (job: Job | FailedItem) => void;
  // New props
  onRemoveFinishedUploads: () => void;
  onEmptyValidation: () => void;
  onEmptyJobQueue: () => void;
  onEmptyFailed: (items: FailedItem[]) => void;
  // Settings for counting limits
  retryLimit: number;
  safetyRetryLimit: number;
}

const Sidebar: React.FC<Props> = ({
  activeTab,
  jobs,
  validationQueue,
  sourceRegistry,
  failedItems,
  selectedSourceIds,
  generatedImages,
  onToggleSource,
  onDeselectAll,
  onRetry,
  onRetryAll,
  onRetrySource,
  onDeleteFailed,
  onDeleteJob,
  onDeleteSource,
  onDeleteAllBlocked,
  onViewJob,
  onRemoveFinishedUploads,
  onEmptyValidation,
  onEmptyJobQueue,
  onEmptyFailed,
  retryLimit,
  safetyRetryLimit
}) => {
  const [showFinishedOnly, setShowFinishedOnly] = useState(false);

  // --- derived lists ---
  const uploads: SourceImage[] = Array.from(sourceRegistry.values());
  const processingJobs = jobs.filter(j => j.status === 'PROCESSING');
  const queuedJobs = jobs.filter(j => j.status === 'QUEUED');

  // Classification for failed items (Combined logic)
  const { failedOrProhibited, blocked } = useMemo(() => {
    const fp: FailedItem[] = [];
    const b: FailedItem[] = [];

    failedItems.forEach(item => {
      const isSafety = item.error.toLowerCase().includes('prohibited') || 
                       item.error.toLowerCase().includes('safety') ||
                       item.error.toLowerCase().includes('blocked');
      
      const maxRetries = isSafety ? safetyRetryLimit : retryLimit;

      if (item.retryCount >= maxRetries) {
        b.push(item);
      } else {
        fp.push(item);
      }
    });

    return { failedOrProhibited: fp, blocked: b };
  }, [failedItems, retryLimit, safetyRetryLimit]);

  // Helper to calculate job statistics for a source
  const getSourceStats = (sourceId: string) => {
    const active = jobs.filter(j => j.sourceImageId === sourceId && j.status === 'PROCESSING').length;
    const queued = jobs.filter(j => j.sourceImageId === sourceId && j.status === 'QUEUED').length;
    const completed = generatedImages.filter(g => g.sourceImageId === sourceId).length;
    
    const sourceFailures = failedItems.filter(f => f.sourceImageId === sourceId);
    
    // Count active failures vs permanently blocked based on user settings
    let failedCount = 0;
    let deadCount = 0;

    sourceFailures.forEach(f => {
        const isSafety = f.error.toLowerCase().includes('prohibited') || f.error.toLowerCase().includes('safety');
        const limit = isSafety ? safetyRetryLimit : retryLimit;
        if (f.retryCount >= limit) deadCount++;
        else failedCount++;
    });
    
    // Total jobs tracked
    const total = active + queued + completed + failedCount + deadCount;
    
    // Status Flags
    const hasActive = active > 0 || queued > 0;
    const hasFailed = failedCount > 0;
    const hasDead = deadCount > 0;
    
    // Finished: No active/queued, no failed (retryable), and has results (or is just done)
    const hasFinished = !hasActive && !hasFailed && !hasDead && total > 0;

    return { active, queued, completed, failedCount, deadCount, total, hasActive, hasFailed, hasDead, hasFinished };
  };

  // Logic for border on uploads
  const getUploadStatusClass = (sourceId: string) => {
      const stats = getSourceStats(sourceId);
      const isValidating = validationQueue.some(v => v.sourceImageId === sourceId);

      if (isValidating) return 'border border-slate-800';

      // "As long as an image in upload still has images that are waiting to be processed, no border should be visible."
      if (stats.hasActive) return 'border border-slate-800';

      // If finished (all done, no errors) -> Violet
      if (stats.hasFinished) return 'border-4 border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.5)]';
      
      // If dead (blocked errors) -> Red
      if (stats.hasDead) return 'border-4 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]';
      
      return 'border border-slate-800';
  };

  // Filter uploads based on "Select Finished" toggle
  const displayUploads = useMemo(() => {
    if (!showFinishedOnly) return uploads;
    return uploads.filter(src => {
        const stats = getSourceStats(src.id);
        const isValidating = validationQueue.some(v => v.sourceImageId === src.id);
        return !isValidating && stats.hasFinished;
    });
  }, [uploads, jobs, generatedImages, failedItems, validationQueue, showFinishedOnly, retryLimit, safetyRetryLimit]);

  const hasFinishedUploads = useMemo(() => {
      return uploads.some(src => getSourceStats(src.id).hasFinished);
  }, [uploads, jobs, generatedImages, failedItems, validationQueue, retryLimit, safetyRetryLimit]);


  // --- Render Helpers ---

  const renderCard = (
    imageUrl: string, 
    title: string, 
    subtitle: React.ReactNode, 
    actions: React.ReactNode, 
    overlay?: React.ReactNode,
    isSelected?: boolean,
    onSelect?: () => void,
    onClick?: () => void,
    extraClasses?: string
  ) => (
    <div 
        className={`relative group mb-4 flex flex-col ${extraClasses || ''} ${onClick || onSelect ? 'cursor-pointer' : ''}`}
        onClick={onClick || onSelect}
    >
      <div 
        className={`relative w-full bg-slate-900 rounded-lg overflow-hidden transition-all hover:shadow-md hover:border-slate-600 ${extraClasses ? '' : 'border border-slate-800'}`}
      >
        <img src={imageUrl} alt="thumbnail" className="w-full h-auto object-cover block opacity-80 group-hover:opacity-100 transition-opacity" />
        
        {/* Checkbox for Filtering */}
        {onSelect && (
            <div className="absolute top-2 left-2 z-20">
                <button 
                    onClick={(e) => { e.stopPropagation(); onSelect(); }}
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                        isSelected 
                        ? 'bg-violet-500 border-violet-500 text-white' 
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
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20" onClick={e => e.stopPropagation()}>
            {actions}
        </div>
      </div>
      
      {/* Options / Details Text */}
      <div className="mt-2 px-1">
          <div className="text-[10px] text-slate-400 leading-relaxed font-mono break-words">{subtitle}</div>
      </div>
    </div>
  );

  const renderEmptyButton = (label: string, onClick: () => void, disabled = false, colorClass = "text-slate-400 hover:text-red-400", borderClass = "border-slate-700 hover:border-red-900/50") => (
      <button 
        onClick={onClick}
        disabled={disabled}
        className={`w-full mb-4 flex items-center justify-center gap-2 py-2 rounded transition-colors text-xs font-bold uppercase tracking-wider border
            ${disabled 
                ? 'bg-slate-900 border-slate-800 text-slate-700 cursor-not-allowed' 
                : `bg-slate-800 hover:bg-slate-700 ${colorClass} ${borderClass}`
            }`}
      >
        <Eraser size={14} /> {label}
      </button>
  );

  const renderTabContent = () => {
    switch(activeTab) {
        case 'UPLOADS':
            return (
                <div className="p-4">
                    {/* Select Finished Filter Toggle */}
                    <button
                        onClick={() => setShowFinishedOnly(!showFinishedOnly)}
                        className={`w-full mb-2 flex items-center justify-center gap-2 py-2 rounded transition-colors text-xs font-bold uppercase tracking-wider border ${
                            showFinishedOnly
                            ? 'bg-violet-900/30 text-violet-400 border-violet-500/50'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                        }`}
                    >
                        <Filter size={14} /> Select Finished
                    </button>

                    {/* Remove Finished Action */}
                    {uploads.length > 0 && (
                        renderEmptyButton(
                            "Remove Finished", 
                            onRemoveFinishedUploads, 
                            !hasFinishedUploads,
                            "text-violet-400 hover:text-red-400", 
                            "border-violet-900/30 hover:border-red-900/50"
                        )
                    )}
                    
                    {displayUploads.length === 0 && <p className="text-slate-600 text-xs italic text-center py-4">
                        {showFinishedOnly ? "No finished uploads found." : "Drag images to upload"}
                    </p>}

                    {displayUploads.map((src) => {
                        const stats = getSourceStats(src.id);
                        const isAnalyzing = src.status === 'VALIDATING';
                        const totalJobs = stats.total;
                        const finishedJobs = stats.completed + stats.deadCount; // "Finished" in terms of process ended, even if blocked
                        const activeFailed = stats.failedCount;
                        
                        let statusText: React.ReactNode = isAnalyzing ? 'Analyzing filename...' : `${src.type} • Source`;
                        if (!isAnalyzing) {
                            statusText = (
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                        <span>Total: {totalJobs}</span>
                                        <span className="text-violet-400">Done: {finishedJobs}</span>
                                        <span className={activeFailed > 0 ? "text-orange-400 font-bold" : "text-slate-600"}>Fail: {activeFailed}</span>
                                    </div>
                                    
                                    {/* Retry Button if failures exist */}
                                    {activeFailed > 0 && (
                                         <button 
                                            onClick={(e) => { e.stopPropagation(); onRetrySource(src.id); }}
                                            className="w-full flex items-center justify-center gap-1.5 py-1 bg-orange-900/30 hover:bg-orange-600 text-orange-400 hover:text-white border border-orange-500/30 rounded text-[10px] font-bold transition-all uppercase"
                                         >
                                             <RefreshCw size={10} /> Retry Failed ({activeFailed})
                                         </button>
                                    )}
                                </div>
                            );
                        }

                        return renderCard(
                            src.previewUrl, 
                            src.name, 
                            statusText,
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDeleteSource(src.id); }} 
                                    className="p-1.5 bg-black/60 hover:bg-red-600 text-white rounded transition-colors" 
                                    title="Delete Source"
                                >
                                    <Trash2 size={12}/>
                                </button>
                            </div>,
                            src.status === 'VALIDATING' ? <Loader2 className="animate-spin text-purple-500" /> : null,
                            selectedSourceIds.has(src.id),
                            () => onToggleSource(src.id),
                            undefined, // Standard click behavior (toggles source)
                            getUploadStatusClass(src.id)
                        );
                    })}
                </div>
            );
        case 'VALIDATING':
            return (
                <div className="p-4">
                    {validationQueue.length > 0 && renderEmptyButton("Empty Queue", onEmptyValidation)}
                    {validationQueue.length === 0 && <p className="text-slate-700 text-xs italic text-center py-4">No images validating</p>}
                    {validationQueue.map(job => {
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
                            () => onToggleSource(job.sourceImageId),
                            onViewJob ? () => onViewJob(job) : undefined
                        );
                    })}
                </div>
             );
        case 'QUEUE':
            return (
                <div className="p-4">
                    {queuedJobs.length > 0 && renderEmptyButton("Empty Queue", onEmptyJobQueue)}
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
                            () => onToggleSource(job.sourceImageId),
                            onViewJob ? () => onViewJob(job) : undefined
                        );
                    })}
                </div>
            );
        case 'FAILED':
             return (
                <div className="p-4">
                    <div className="flex gap-2 mb-4">
                        {failedOrProhibited.length > 0 && (
                            <button 
                                onClick={() => onRetryAll(failedOrProhibited)}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-orange-900/40 text-orange-400 hover:text-orange-200 border border-orange-900/50 rounded transition-colors text-xs font-bold uppercase tracking-wider"
                            >
                                <RotateCcw size={14} /> Retry All
                            </button>
                        )}
                        {failedOrProhibited.length > 0 && (
                             <button 
                                onClick={() => onEmptyFailed(failedOrProhibited)}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 rounded transition-colors text-xs font-bold uppercase tracking-wider"
                            >
                                <Eraser size={14} /> Empty
                            </button>
                        )}
                    </div>

                    {blocked.length > 0 && (
                        <div className="mb-6 p-3 bg-slate-900 border border-red-900/30 rounded-lg">
                             <div className="flex items-center justify-between mb-2">
                                 <h4 className="text-xs font-bold text-red-400 uppercase">Blocked ({blocked.length})</h4>
                                 <button 
                                     onClick={() => onDeleteAllBlocked(blocked)}
                                     className="text-xs text-red-500 hover:text-white flex items-center gap-1"
                                 >
                                     <Trash2 size={12} /> Clear
                                 </button>
                             </div>
                             <div className="space-y-3">
                                {blocked.map(item => (
                                    renderCard(
                                        item.sourceImagePreview, 
                                        'Max Retries Exceeded', 
                                        item.error,
                                        <button onClick={() => onDeleteFailed(item.id)} className="p-1.5 bg-black/60 hover:bg-slate-700 text-white rounded"><Trash2 size={12}/></button>,
                                        <XCircle className="text-slate-500 w-8 h-8" />,
                                        selectedSourceIds.has(item.sourceImageId),
                                        () => onToggleSource(item.sourceImageId),
                                        onViewJob ? () => onViewJob(item) : undefined
                                    )
                                ))}
                             </div>
                        </div>
                    )}

                    <h4 className="text-xs font-bold text-orange-400 uppercase mb-2">Retriable ({failedOrProhibited.length})</h4>
                    {failedOrProhibited.length === 0 && <p className="text-slate-700 text-xs italic text-center py-4">No retriable failures</p>}
                    
                    {failedOrProhibited.map(item => {
                        const isSafety = item.error.toLowerCase().includes('prohibited') || item.error.toLowerCase().includes('safety');
                        const limit = isSafety ? safetyRetryLimit : retryLimit;
                        
                        return renderCard(
                            item.sourceImagePreview, 
                            isSafety ? 'Prohibited Content' : `Failed: ${item.retryCount}/${limit}`, 
                            `${item.error.substring(0, 100)}...`,
                            <div className="flex gap-1">
                                <button onClick={() => onRetry(item)} className="p-1.5 bg-black/60 hover:bg-emerald-600 text-white rounded"><RefreshCw size={12}/></button>
                                <button onClick={() => onDeleteFailed(item.id)} className="p-1.5 bg-black/60 hover:bg-slate-700 text-white rounded"><Trash2 size={12}/></button>
                            </div>,
                            isSafety ? <Ban className="text-red-500 w-8 h-8" /> : <AlertTriangle className="text-orange-500 w-8 h-8" />,
                            selectedSourceIds.has(item.sourceImageId),
                            () => onToggleSource(item.sourceImageId),
                            onViewJob ? () => onViewJob(item) : undefined
                        );
                    })}
                </div>
             );
    }
    return null; // Should not happen
  };

  return (
    <div className="w-full h-full bg-slate-950 flex flex-col border-r border-slate-800">
        {/* Action Header for current tab */}
        <div className="px-4 py-2 bg-slate-900/50 border-b border-slate-800 flex justify-between items-center text-xs">
             <span className="text-slate-400 font-bold uppercase">{activeTab} List</span>
             {activeTab === 'UPLOADS' && selectedSourceIds.size > 0 && (
                <button onClick={onDeselectAll} className="text-[10px] text-violet-400 hover:text-white flex items-center gap-1">
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