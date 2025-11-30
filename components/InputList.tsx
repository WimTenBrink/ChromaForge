import React, { useState, DragEvent } from 'react';
import { Upload, X, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { InputImage, Job } from '../types';

interface Props {
  inputs: InputImage[];
  activeJobs: Job[];
  onAddFiles: (files: FileList) => void;
  onRemove: (id: string) => void;
  onRerun: (id: string) => void;
}

const InputList: React.FC<Props> = ({ inputs, activeJobs, onAddFiles, onRemove, onRerun }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we are actually leaving the label, not entering a child
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Filter for images
      const files: File[] = Array.from(e.dataTransfer.files);
      const imageFiles = files.filter(file => file.type.startsWith('image/'));
      
      if (imageFiles.length > 0) {
        // Create a new DataTransfer to get a FileList
        const dt = new DataTransfer();
        imageFiles.forEach(file => dt.items.add(file));
        onAddFiles(dt.files);
      }
    }
  };

  return (
    <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col h-full">
      <div className="p-4 border-b border-slate-800">
        <h2 className="font-bold text-slate-200 mb-4">Input Queue</h2>
        <label 
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer transition-all group ${
            isDragging 
              ? 'border-emerald-500 bg-emerald-900/20' 
              : 'border-slate-700 bg-slate-800 hover:bg-slate-750 hover:border-emerald-500'
          }`}
        >
          <div className="flex flex-col items-center justify-center pt-5 pb-6 pointer-events-none">
            <Upload className={`w-8 h-8 mb-2 transition-colors ${
                isDragging ? 'text-emerald-400' : 'text-slate-400 group-hover:text-emerald-400'
            }`} />
            <p className={`text-xs ${isDragging ? 'text-emerald-300' : 'text-slate-400'}`}>
                {isDragging ? 'Drop images here' : 'Click or Drag & Drop'}
            </p>
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
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {inputs.length === 0 && (
          <div className="text-center text-slate-600 text-sm mt-10 italic">
            No images queued.
          </div>
        )}
        {inputs.map((input) => {
          // Find if there is an active job for this input
          const activeJob = activeJobs.find(job => job.sourceImageId === input.id);
          const isDone = input.status === 'COMPLETED' || input.status === 'PARTIAL' || input.status === 'FAILED';

          return (
            <div key={input.id} className={`relative group bg-slate-800 rounded-lg overflow-hidden border ${
                input.status === 'FAILED' ? 'border-red-900/50' : 'border-slate-700'
            }`}>
              {/* Top right delete button (only when not processing) */}
              {input.status !== 'PROCESSING' && input.status !== 'ANALYZING' && (
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button 
                      onClick={() => onRemove(input.id)}
                      className="bg-black/50 hover:bg-red-500 text-white p-1 rounded-full backdrop-blur-sm"
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  </div>
              )}

              <div className="h-32 w-full overflow-hidden">
                  <img src={input.previewUrl} alt="preview" className="w-full h-full object-cover" />
              </div>
              <div className="p-3">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-mono text-slate-400 truncate w-3/4" title={input.file ? input.file.name : input.name}>
                        {input.file ? input.file.name : input.name}
                    </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                      <span className={`font-bold flex items-center gap-1 ${
                          input.status === 'PROCESSING' || input.status === 'ANALYZING' ? 'text-amber-400' :
                          input.status === 'COMPLETED' ? 'text-emerald-400' :
                          input.status === 'FAILED' ? 'text-red-400' :
                          'text-slate-500'
                      }`}>
                          {(input.status === 'PROCESSING' || input.status === 'ANALYZING') && <Loader2 size={10} className="animate-spin"/>}
                          {input.status}
                      </span>
                      {input.totalVariations > 0 && (
                          <span className="text-slate-500">
                            {input.completedVariations} / {input.totalVariations}
                          </span>
                      )}
                </div>
                {input.status === 'PROCESSING' && (
                    <div className="w-full bg-slate-900 h-1 mt-2 rounded-full overflow-hidden">
                        <div 
                          className="bg-amber-500 h-full transition-all duration-500"
                          style={{ width: `${(input.completedVariations / Math.max(input.totalVariations, 1)) * 100}%`}}
                        />
                    </div>
                )}
                
                {/* Visual Feedback for active options */}
                {activeJob && (
                    <div className="mt-2 p-2 bg-slate-900/50 rounded border border-slate-700/50">
                        <div className="flex items-center gap-2 text-[10px] text-amber-300 animate-pulse">
                           <Loader2 size={10} className="animate-spin" />
                           <span className="font-bold">Generating Variation:</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 leading-tight line-clamp-3">
                           {activeJob.optionsSummary}
                        </p>
                    </div>
                )}

                {/* Actions for completed/failed items */}
                {isDone && (
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-700/50 pt-2">
                        <button 
                            onClick={() => onRerun(input.id)}
                            className="flex items-center justify-center gap-1 bg-slate-700 hover:bg-emerald-700 text-slate-300 hover:text-white py-1.5 rounded text-[10px] font-bold transition-colors"
                        >
                            <RefreshCw size={12} /> Rerun
                        </button>
                        <button 
                            onClick={() => onRemove(input.id)}
                            className="flex items-center justify-center gap-1 bg-slate-700 hover:bg-red-900 text-slate-300 hover:text-red-200 py-1.5 rounded text-[10px] font-bold transition-colors"
                        >
                            <Trash2 size={12} /> Delete
                        </button>
                    </div>
                )}

              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default InputList;