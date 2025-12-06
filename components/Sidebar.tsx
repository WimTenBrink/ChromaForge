import React, { useMemo, useState, useRef } from 'react';
import { Job, SourceImage, FailedItem, ValidationJob, GeneratedImage, SidebarTab } from '../types';
import { Check, Trash2, RefreshCw, AlertTriangle, XCircle, Loader2, Layers, ScanSearch, RotateCcw, Eraser, Filter, AlertCircle, Ban, ArrowUp, ArrowDown, Copy, Upload } from 'lucide-react';

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
  onPrioritizeSource?: (id: string) => void;
  // Settings for counting limits
  retryLimit: number;
  safetyRetryLimit: number;
  // Sidebar resizing
  sidebarWidth: number;
  setSidebarWidth: (w: number) => void;
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
  onPrioritizeSource,
  retryLimit,
  safetyRetryLimit,
  sidebarWidth,
  setSidebarWidth
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  const scrollToBottom = () => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  
  // --- derived lists ---
  const uploads: SourceImage[] = (Array.from(sourceRegistry.values()) as SourceImage[]).sort((a, b) => {
      const pA = a.priorityCount || 0;
      const pB = b.priorityCount || 0;
      if (pA !== pB) return pB - pA; // Descending priority
      return 0; // Stable sort
  });

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
    let prohibitedCount = 0;

    sourceFailures.forEach(f => {
        const isSafety = f.error.toLowerCase().includes('prohibited') || f.error.toLowerCase().includes('safety');
        const limit = isSafety ? safetyRetryLimit : retryLimit;
        
        if (isSafety) prohibitedCount++;

        if (f.retryCount >= limit) deadCount++;
        else failedCount++;
    });
    
    // Total jobs tracked
    const total = active + queued + completed + failedCount + deadCount;
    
    // Status Flags
    const hasActive = active > 0 || queued > 0;
    const hasFailed = failedCount > 0;
    const hasDead = deadCount > 0;
    
    // Finished: No active/queued, no retriable failed. Dead jobs don't prevent finish.
    const hasFinished = !hasActive && !hasFailed && total > 0;

    return { active, queued, completed, failedCount, deadCount, prohibitedCount, total, hasActive, hasFailed, hasDead, hasFinished };
  };

  // Logic for border on uploads
  const getUploadStatusClass = (sourceId: string) => {
      const stats = getSourceStats(sourceId);
      const isValidating = validationQueue.some(v => v.sourceImageId === sourceId);

      if (isValidating) return 'border border-slate-800';

      // "As long as an image in upload still has images that are waiting to be processed, no border should be visible."
      if (stats.hasActive) return 'border border-slate-800';
      if (stats.hasFailed) return 'border border-slate-800';

      // If finished (all done, no retriable errors) -> Violet
      if (stats.hasFinished) return 'border-4 border-violet-500 shadow-[0_0_15px_rgba(139,92,246,0.5)]';
      
      return 'border border-slate-800';
  };

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
    extraClasses?: string,
    badges?: React.ReactNode
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

        {/* Badges Container */}
        {badges && (
             <div className="absolute top-8 left-2 right-2 z-20 pointer-events-none flex flex-col gap-1 items-start">
                 {badges}
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
                    {/* Retry All Button */}
                    {failedOrProhibited.length > 0 && (
                        <button 
                            onClick={() => onRetryAll(failedOrProhibited)}
                            className="w-full mb-2 flex items-center justify-center gap-2 py-2 bg-orange-900/30 hover:bg-orange-600 text-orange-400 hover:text-white border border-orange-500/30 rounded transition-colors text-xs font-bold uppercase tracking-wider"
                        >
                            <RotateCcw size={14} /> Retry All Failed ({failedOrProhibited.length})
                        </button>
                    )}
                    
                    {uploads.length === 0 && <p className="text-slate-600 text-xs italic text-center py-4">
                        Drag images to upload
                    </p>}

                    {uploads.map((src) => {
                        const stats = getSourceStats(src.id);
                        const isAnalyzing = src.status === 'VALIDATING';
                        const totalJobs = stats.total;
                        const waitRun = stats.queued + stats.active;
                        const failed = stats.failedCount; // Retriable failures
                        const dead = stats.deadCount; // Max retries reached
                        
                        let statusText: React.ReactNode = isAnalyzing ? 'Analyzing filename...' : `${src.type} • Source`;
                        if (!isAnalyzing) {
                            statusText = (
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono bg-slate-900 p-1 rounded border border-slate-800">
                                        <div className="flex gap-2">
                                            <span title="Total Jobs">Tot: {totalJobs}</span>
                                            <span title="Waiting/Running" className="text-blue-400">Run: {waitRun}</span>
                                            <span title="Failed (Retriable)" className={failed > 0 ? "text-orange-400 font-bold" : "text-slate-600"}>Fail: {failed}</span>
                                        </div>
                                    </div>
                                    
                                    {/* Finished / Max Retry Status */}
                                    {stats.hasFinished && (
                                        <div className="text-[10px] text-center font-bold text-violet-500 uppercase">
                                            Finished
                                        </div>
                                    )}
                                    {stats.hasDead && !stats.hasActive && !stats.hasFailed && !stats.hasFinished && (
                                        <div className="text-[10px] text-center font-bold text-red-500 uppercase">
                                            Max Retries Reached
                                        </div>
                                    )}

                                    {/* Retry Button if failures exist */}
                                    {failed > 0 && (
                                         <button 
                                            onClick={(e) => { e.stopPropagation(); onRetrySource(src.id); }}
                                            className="w-full flex items-center justify-center gap-1.5 py-1 bg-orange-900/30 hover:bg-orange-600 text-orange-400 hover:text-white border border-orange-500/30 rounded text-[10px] font-bold transition-all uppercase"
                                         >
                                             <RefreshCw size={10} /> Retry Failed ({failed})
                                         </button>
                                    )}
                                </div>
                            );
                        }

                        // Badges Logic
                        const badges = (
                            <>
                                {src.duplicateCount && src.duplicateCount > 0 ? (
                                    <div className="bg-amber-500 text-black text-[10px] font-bold px-2 py-0.5 rounded shadow-lg flex items-center gap-1 border border-black/20">
                                        <Copy size={10} /> Duplicate ({src.duplicateCount}x)
                                    </div>
                                ) : null}
                                {stats.prohibitedCount > 0 ? (
                                    <div className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg flex items-center gap-1 border border-black/20">
                                        <Ban size={10} /> Prohibited ({stats.prohibitedCount}x)
                                    </div>
                                ) : null}
                                {src.priorityCount && src.priorityCount > 0 ? (
                                    <div className="bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg flex items-center gap-1 border border-black/20">
                                        <ArrowUp size={10} /> Priority ({src.priorityCount}x)
                                    </div>
                                ) : null}
                            </>
                        );

                        return renderCard(
                            src.previewUrl, 
                            src.name, 
                            statusText,
                            <div className="flex items-center gap-1">
                                {!isAnalyzing && onPrioritizeSource && (stats.hasActive) && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onPrioritizeSource(src.id); }}
                                        className="p-1.5 bg-black/60 hover:bg-blue-500 text-white rounded transition-colors"
                                        title="Prioritize Jobs"
                                    >
                                        <ArrowUp size={12} />
                                    </button>
                                )}
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
                            getUploadStatusClass(src.id),
                            badges
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
                            <div className="flex gap-1">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDeleteJob(job.id); }} 
                                    className="p-1.5 bg-black/60 hover:bg-red-600 text-white rounded transition-colors"
                                    title="Cancel Job"
                                >
                                    <Trash2 size={12}/>
                                </button>
                            </div>,
                            <div className="flex flex-col items-center justify-center text-amber-500 bg-black/40 p-2 rounded">
                                <Loader2 className="animate-spin mb-1" size={20} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Processing</span>
                            </div>,
                            selectedSourceIds.has(job.sourceImageId),
                            () => onToggleSource(job.sourceImageId),
                            () => onViewJob && onViewJob(job),
                            'border-l-4 border-amber-500'
                        );
                    })}
                </div>
             );
        case 'QUEUE':
            return (
                <div className="p-4">
                    {queuedJobs.length > 0 && renderEmptyButton("Clear Queue", onEmptyJobQueue)}
                    {queuedJobs.length === 0 && <p className="text-slate-700 text-xs italic text-center py-4">Queue is empty</p>}
                    {queuedJobs.map(job => {
                        const src = sourceRegistry.get(job.sourceImageId);
                        if (!src) return null;
                        return renderCard(
                            src.previewUrl, 
                            job.originalFilename, 
                            job.optionsSummary,
                            <div className="flex gap-1">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onDeleteJob(job.id); }} 
                                    className="p-1.5 bg-black/60 hover:bg-red-600 text-white rounded transition-colors" 
                                    title="Remove from Queue"
                                >
                                    <Trash2 size={12}/>
                                </button>
                            </div>,
                            <div className="flex flex-col items-center justify-center text-blue-400 bg-black/40 p-2 rounded">
                                <Layers size={20} className="mb-1" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Queued</span>
                            </div>,
                            selectedSourceIds.has(job.sourceImageId),
                            () => onToggleSource(job.sourceImageId),
                            () => onViewJob && onViewJob(job),
                            'border-l-4 border-blue-500'
                        );
                    })}
                </div>
            );
        case 'FAILED':
            return (
                <div className="p-4 space-y-8">
                    {/* Retryable Failures */}
                    <div>
                        <div className="flex justify-between items-center mb-2 px-1">
                            <h3 className="text-xs font-bold text-slate-400 uppercase">Failed / Prohibited</h3>
                            <span className="text-[10px] text-slate-500">{failedOrProhibited.length} items</span>
                        </div>
                        
                        {failedOrProhibited.length > 0 && (
                            <div className="flex gap-2 mb-4">
                                <button 
                                    onClick={() => onRetryAll(failedOrProhibited)}
                                    className="flex-1 py-2 bg-orange-900/30 hover:bg-orange-600 text-orange-400 hover:text-white border border-orange-500/30 rounded transition-colors text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                                >
                                    <RefreshCw size={14} /> Retry All
                                </button>
                                <button 
                                    onClick={() => onEmptyFailed(failedOrProhibited)}
                                    className="px-3 py-2 bg-slate-800 hover:bg-red-900/50 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-900 rounded transition-colors"
                                    title="Dismiss All"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        )}

                        {failedOrProhibited.length === 0 && <p className="text-slate-700 text-xs italic text-center py-2">No retryable failures</p>}

                        {failedOrProhibited.map(item => {
                            // Check if prohibited (safety)
                            const isSafety = item.error.toLowerCase().includes('prohibited') || item.error.toLowerCase().includes('safety');
                            return renderCard(
                                item.sourceImagePreview,
                                item.originalJob?.originalFilename || "Unknown Job",
                                <span className="text-red-400">{item.error}</span>,
                                <div className="flex gap-1">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onRetry(item); }} 
                                        className="p-1.5 bg-black/60 hover:bg-green-600 text-white rounded transition-colors" 
                                        title="Retry"
                                    >
                                        <RefreshCw size={12}/>
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onDeleteFailed(item.id); }} 
                                        className="p-1.5 bg-black/60 hover:bg-red-600 text-white rounded transition-colors" 
                                        title="Dismiss"
                                    >
                                        <Trash2 size={12}/>
                                    </button>
                                </div>,
                                <div className="flex flex-col items-center justify-center text-orange-500 bg-black/40 p-2 rounded">
                                    {isSafety ? <Ban size={20} className="mb-1" /> : <AlertTriangle size={20} className="mb-1" />}
                                    <span className="text-[10px] font-bold uppercase tracking-wider">{isSafety ? 'Prohibited' : 'Failed'}</span>
                                </div>,
                                selectedSourceIds.has(item.sourceImageId),
                                () => onToggleSource(item.sourceImageId),
                                () => onViewJob && onViewJob(item),
                                'border-l-4 border-orange-500'
                            );
                        })}
                    </div>

                    {/* Blocked / Dead */}
                    <div>
                         <div className="flex justify-between items-center mb-2 px-1 pt-4 border-t border-slate-800">
                            <h3 className="text-xs font-bold text-slate-400 uppercase">Blocked (Max Retries)</h3>
                            <span className="text-[10px] text-slate-500">{blocked.length} items</span>
                        </div>
                        
                        {blocked.length > 0 && renderEmptyButton("Delete All Blocked", () => onDeleteAllBlocked(blocked))}
                        {blocked.length === 0 && <p className="text-slate-700 text-xs italic text-center py-2">No blocked items</p>}

                        {blocked.map(item => (
                             renderCard(
                                item.sourceImagePreview,
                                item.originalJob?.originalFilename || "Unknown Job",
                                <span className="text-slate-500">{item.error}</span>,
                                <div className="flex gap-1">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); onDeleteFailed(item.id); }} 
                                        className="p-1.5 bg-black/60 hover:bg-red-600 text-white rounded transition-colors" 
                                        title="Delete"
                                    >
                                        <Trash2 size={12}/>
                                    </button>
                                </div>,
                                <div className="flex flex-col items-center justify-center text-red-600 bg-black/40 p-2 rounded">
                                    <XCircle size={20} className="mb-1" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Blocked</span>
                                </div>,
                                selectedSourceIds.has(item.sourceImageId),
                                () => onToggleSource(item.sourceImageId),
                                () => onViewJob && onViewJob(item),
                                'border-l-4 border-slate-700 opacity-75'
                            )
                        ))}
                    </div>
                </div>
            );
        default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-950">
        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
            {renderTabContent()}
        </div>
        
        {/* Footer Actions (if needed) */}
        {activeTab === 'UPLOADS' && uploads.length > 0 && (
             <div className="p-4 border-t border-slate-900 bg-slate-950">
                  <button 
                    onClick={onRemoveFinishedUploads}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-violet-900/20 text-slate-500 hover:text-violet-400 border border-slate-800 hover:border-violet-500/30 rounded-lg transition-all text-xs font-bold uppercase tracking-wider"
                  >
                      <Check size={14} /> Clear Finished
                  </button>
             </div>
        )}
    </div>
  );
};

export default Sidebar;