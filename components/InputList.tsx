import React from 'react';
import { Upload, X, Loader2, Trash2, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown, Search, CheckCircle } from 'lucide-react';
import { Job, SourceImage } from '../types';

interface Props {
  jobs: Job[];
  sourceRegistry: Map<string, SourceImage>;
  onAddFiles: (files: FileList) => void;
  onRemoveJob: (id: string) => void;
  onMoveJob: (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => void;
  onZoom: (data: { url: string, title: string, metadata: string }) => void;
}

const InputList: React.FC<Props> = ({ jobs, sourceRegistry, onAddFiles, onRemoveJob, onMoveJob, onZoom }) => {
  
  // Filter for active jobs (Queue or Processing)
  const activeJobs = jobs.filter(j => j.status === 'QUEUED' || j.status === 'PROCESSING');

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
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {activeJobs.length === 0 && (
          <div className="text-center text-slate-600 text-sm mt-10 italic">
            Queue is empty.
          </div>
        )}
        {activeJobs.map((job, index) => {
          const source = sourceRegistry.get(job.sourceImageId);
          if (!source) return null; // Should not happen

          const isProcessing = job.status === 'PROCESSING';

          return (
            <div key={job.id} className={`relative group bg-slate-800 rounded-lg overflow-hidden border transition-all ${
                isProcessing ? 'border-amber-500/50 shadow-[0_0_15px_-3px_rgba(245,158,11,0.2)]' : 'border-slate-700 hover:border-slate-600'
            }`}>
              
              {/* Queue Controls (Only for Queued items) */}
              {!isProcessing && (
                  <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 flex flex-col gap-1">
                      <div className="flex gap-1">
                          <button onClick={(e) => { e.stopPropagation(); onMoveJob(job.id, 'top'); }} className="bg-black/50 hover:bg-emerald-600 text-white p-1 rounded backdrop-blur-sm" title="Move to Top">
                              <ChevronsUp size={12} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onMoveJob(job.id, 'up'); }} className="bg-black/50 hover:bg-emerald-600 text-white p-1 rounded backdrop-blur-sm" title="Move Up">
                              <ArrowUp size={12} />
                          </button>
                      </div>
                      <div className="flex gap-1">
                          <button onClick={(e) => { e.stopPropagation(); onMoveJob(job.id, 'down'); }} className="bg-black/50 hover:bg-emerald-600 text-white p-1 rounded backdrop-blur-sm" title="Move Down">
                              <ArrowDown size={12} />
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); onMoveJob(job.id, 'bottom'); }} className="bg-black/50 hover:bg-emerald-600 text-white p-1 rounded backdrop-blur-sm" title="Move to Bottom">
                              <ChevronsDown size={12} />
                          </button>
                      </div>
                  </div>
              )}

              {/* Delete Action */}
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <button 
                  onClick={(e) => { e.stopPropagation(); onRemoveJob(job.id); }}
                  className="bg-black/50 hover:bg-red-500 text-white p-1 rounded-full backdrop-blur-sm"
                  title="Remove Job"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Full Width Image Thumbnail */}
              <div 
                className="w-full aspect-square overflow-hidden bg-slate-950 relative cursor-zoom-in"
                onClick={() => onZoom({ 
                    url: source.previewUrl, 
                    title: `Source: ${source.name}`, 
                    metadata: job.optionsSummary 
                })}
              >
                  <img src={source.previewUrl} alt="source" className={`w-full h-full object-cover transition-all duration-700 ${isProcessing ? 'scale-110 opacity-60' : 'opacity-100'}`} />
                  
                  {/* Zoom Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/20 transition-opacity pointer-events-none">
                      <Search className="text-white drop-shadow-lg" size={24} />
                  </div>

                  {isProcessing && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
                          <Loader2 className="animate-spin text-amber-400" size={32} />
                      </div>
                  )}
              </div>

              {/* Job Details */}
              <div className="p-3">
                <div className="flex justify-between items-start mb-1">
                    <span className="text-[10px] font-mono text-slate-500 truncate w-3/4" title={source.name}>
                        {source.name}
                    </span>
                    <span className="text-[10px] font-mono text-slate-600">#{index + 1}</span>
                </div>
                
                <p className="text-xs text-slate-300 font-medium leading-tight line-clamp-2 mb-2" title={job.optionsSummary}>
                   {job.optionsSummary || "Default / As-Is"}
                </p>

                <div className="flex justify-between items-center text-[10px]">
                      <span className={`font-bold flex items-center gap-1 ${
                          isProcessing ? 'text-amber-400' : 'text-slate-500'
                      }`}>
                          {isProcessing ? 'PROCESSING...' : 'QUEUED'}
                      </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InputList;