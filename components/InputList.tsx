import React, { useMemo } from 'react';
import { Upload, X, Loader2, Trash2, ArrowUp, ArrowDown, Layers } from 'lucide-react';
import { Job, SourceImage } from '../types';

interface Props {
  jobs: Job[];
  sourceRegistry: Map<string, SourceImage>;
  onAddFiles: (files: FileList) => void;
  onRemoveJob: (id: string) => void;
  onRemoveJobGroup: (sourceId: string) => void;
  onMoveJob: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  onZoom: (data: { url: string, title: string, metadata: string }) => void;
}

const InputList: React.FC<Props> = ({ jobs, sourceRegistry, onAddFiles, onRemoveJob, onRemoveJobGroup, onMoveJob, onZoom }) => {
  
  // Filter for active jobs (Queue or Processing)
  const activeJobs = jobs.filter(j => j.status === 'QUEUED' || j.status === 'PROCESSING');

  // Group jobs by Source Image ID
  const groupedJobs = useMemo(() => {
    const groups = new Map<string, Job[]>();
    activeJobs.forEach(job => {
        if (!groups.has(job.sourceImageId)) {
            groups.set(job.sourceImageId, []);
        }
        groups.get(job.sourceImageId)!.push(job);
    });
    return groups;
  }, [activeJobs]);

  return (
    <div className="w-80 bg-slate-900 border-r border-slate-800 flex flex-col h-full shrink-0">
      <div className="p-4 border-b border-slate-800">
        <h2 className="font-bold text-slate-200 mb-4 flex justify-between items-center">
            <span>Job Queue</span>
            <span className="text-xs text-slate-500">{activeJobs.length} Pending</span>
        </h2>
        {/* Simple Add Button for Click (Drag is global) */}
        <label className="flex flex-col items-center justify-center w-full h-12 border border-dashed border-slate-700 rounded-lg cursor-pointer bg-slate-800 hover:bg-slate-750 hover:border-emerald-500 transition-all">
          <div className="flex items-center gap-2 pointer-events-none text-slate-400">
            <Upload className="w-4 h-4" />
            <span className="text-xs font-bold">Add Images</span>
          </div>
          <input 
            type="file" 
            className="hidden" 
            multiple 
            accept="image/*"
            onChange={(e) => e.target.files && onAddFiles(e.target.files)} 
          />
        </label>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeJobs.length === 0 && (
          <div className="text-center text-slate-600 text-sm mt-10 italic">
            Queue is empty.
          </div>
        )}
        
        {Array.from(groupedJobs.entries()).map(([sourceId, groupJobs]) => {
            const source = sourceRegistry.get(sourceId);
            if (!source) return null;

            return (
                <div key={sourceId} className="bg-slate-800/20 rounded-lg border border-slate-700 overflow-hidden shadow-md">
                    {/* Full Width Header Image */}
                    <div className="relative h-32 w-full bg-slate-950 border-b border-slate-700 group/header">
                         <img 
                             src={source.previewUrl} 
                             className="w-full h-full object-cover opacity-50 group-hover/header:opacity-100 transition-all duration-500 cursor-zoom-in"
                             alt="thumb"
                             onClick={() => onZoom({ 
                                 url: source.previewUrl, 
                                 title: `Source: ${source.name}`, 
                                 metadata: `Group of ${groupJobs.length} jobs` 
                             })}
                         />
                         
                         {/* Controls & Title Overlay */}
                         <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none">
                             <div className="flex justify-end pointer-events-auto">
                                 <button 
                                     onClick={() => onRemoveJobGroup(sourceId)}
                                     className="bg-black/40 hover:bg-red-600/90 text-slate-300 hover:text-white p-1.5 rounded-lg backdrop-blur-sm transition-colors border border-white/5"
                                     title="Delete Whole Group"
                                 >
                                     <Trash2 size={14} />
                                 </button>
                             </div>
                             
                             <div className="pointer-events-auto">
                                 <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md p-2 rounded-lg border border-slate-700/50 shadow-lg">
                                      <div className="flex-1 min-w-0">
                                          <h3 className="font-bold text-xs text-white truncate" title={source.name}>{source.name}</h3>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0 bg-slate-800 px-1.5 py-0.5 rounded text-[10px] text-emerald-400 border border-emerald-500/20">
                                         <Layers size={10} />
                                         <span className="font-mono font-bold">{groupJobs.length}</span>
                                     </div>
                                 </div>
                             </div>
                         </div>
                    </div>
                    
                    {/* Jobs in Group */}
                    <div className="p-2 space-y-1 bg-slate-900/30">
                        {groupJobs.map((job) => {
                             const isProcessing = job.status === 'PROCESSING';
                             return (
                                <div key={job.id} className={`relative group flex items-center justify-between p-2 rounded border transition-all ${
                                     isProcessing 
                                     ? 'bg-amber-900/10 border-amber-500/30' 
                                     : 'bg-slate-800/40 border-slate-700/30 hover:bg-slate-700 hover:border-slate-600'
                                }`}>
                                    <div className="flex-1 min-w-0 pr-2">
                                        <p className="text-[11px] text-slate-300 font-medium truncate" title={job.optionsSummary}>
                                            {job.optionsSummary || "Default / As-Is"}
                                        </p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {isProcessing ? (
                                                <div className="flex items-center gap-1 text-[9px] text-amber-500 font-bold">
                                                    <Loader2 size={8} className="animate-spin" />
                                                    <span>PROCESSING</span>
                                                </div>
                                            ) : (
                                                <span className="text-[9px] text-slate-500 font-mono">QUEUED</span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Item Actions */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!isProcessing && (
                                            <>
                                                <div className="flex flex-col gap-0.5 mr-1">
                                                    <button onClick={() => onMoveJob(job.id, 'up')} className="text-slate-500 hover:text-emerald-400" title="Move Up"><ArrowUp size={10} /></button>
                                                    <button onClick={() => onMoveJob(job.id, 'down')} className="text-slate-500 hover:text-emerald-400" title="Move Down"><ArrowDown size={10} /></button>
                                                </div>
                                            </>
                                        )}
                                        <button 
                                            onClick={() => onRemoveJob(job.id)}
                                            className="text-slate-500 hover:text-red-400 p-1 hover:bg-slate-950 rounded"
                                            title="Remove Item"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                </div>
                             );
                        })}
                    </div>
                </div>
            );
        })}
      </div>
    </div>
  );
};

export default InputList;