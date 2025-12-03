import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, Settings, Terminal, Plus, Shield, ShieldCheck, Trash2, Loader2, Activity, Book, Upload, Clock } from 'lucide-react';
import InputList from './components/InputList';
import FailedList from './components/FailedList';
import OptionsDialog from './components/OptionsDialog';
import ConsoleDialog from './components/ConsoleDialog';
import ImageDetailDialog from './components/ImageDetailDialog';
import ManualDialog from './components/ManualDialog';
import { AppOptions, Job, GeneratedImage, FailedItem, ImageAnalysis, GlobalConfig, SourceImage } from './types';
import { DEFAULT_OPTIONS, MAX_CONCURRENT_JOBS } from './constants';
import { generatePermutations, buildPromptFromCombo } from './utils/combinatorics';
import { processImage, analyzeImage } from './services/geminiService';
import { log } from './services/logger';

const App: React.FC = () => {
  // --- State ---
  const [options, setOptions] = useState<AppOptions>(DEFAULT_OPTIONS);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null);
  
  // Data Store
  const [sourceRegistry, setSourceRegistry] = useState<Map<string, SourceImage>>(new Map());
  const [jobQueue, setJobQueue] = useState<Job[]>([]); // The main queue (Queued, Processing, Completed)
  
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [failedItems, setFailedItems] = useState<FailedItem[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  
  // View Viewer (Zoom)
  const [viewedImage, setViewedImage] = useState<GeneratedImage | { url: string, title: string, metadata: string } | null>(null);
  
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Statistics & Timing
  const [jobDurations, setJobDurations] = useState<number[]>([]);

  // Derived Statistics
  const activeJobs = jobQueue.filter(j => j.status === 'QUEUED' || j.status === 'PROCESSING');
  const processingCount = jobQueue.filter(j => j.status === 'PROCESSING').length;
  
  const totalVariationsScheduled = jobQueue.length + generatedImages.length + failedItems.length;
  const totalCompleted = generatedImages.length;
  const averageDurationMs = jobDurations.length > 0 
      ? jobDurations.reduce((a, b) => a + b, 0) / jobDurations.length 
      : 15000; // Default estimate 15s
  const estimatedRemainingMs = activeJobs.length * averageDurationMs;

  const formatTime = (ms: number) => {
      if (activeJobs.length === 0) return "00:00";
      const seconds = Math.floor((ms / 1000) % 60);
      const minutes = Math.floor((ms / (1000 * 60)) % 60);
      const hours = Math.floor((ms / (1000 * 60 * 60)));
      
      const m = minutes.toString().padStart(2, '0');
      const s = seconds.toString().padStart(2, '0');
      
      if (hours > 0) return `${hours}:${m}:${s}`;
      return `${m}:${s}`;
  };

  // --- Persistence ---

  useEffect(() => {
    // Load options from localStorage
    const savedOptions = localStorage.getItem('chromaforge_options');
    if (savedOptions) {
        try {
            const parsed = JSON.parse(savedOptions);
            setOptions({ ...DEFAULT_OPTIONS, ...parsed });
        } catch (e) { console.error('Failed to parse options', e); }
    }

    // Load Global Config from JSON file
    fetch('./options.json')
      .then(res => res.json())
      .then((data: GlobalConfig) => {
          setGlobalConfig(data);
          log('INFO', 'Configuration loaded', {});
      })
      .catch(err => {
          log('ERROR', 'Failed to load options.json', err);
          alert("Failed to load configuration file. Check console.");
      });
  }, []);

  useEffect(() => {
      localStorage.setItem('chromaforge_options', JSON.stringify(options));
  }, [options]);

  // --- Initialization ---
  useEffect(() => {
      const checkKey = async () => {
          if (process.env.API_KEY) {
              setApiKeyReady(true);
              return;
          }
          if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
              setApiKeyReady(true);
          }
      };
      checkKey();
  }, []);

  const handleApiKeySelect = async () => {
      if (window.aistudio) {
          try {
              await window.aistudio.openSelectKey();
              if (await window.aistudio.hasSelectedApiKey()) {
                  setApiKeyReady(true);
              }
          } catch (e) {
              log('ERROR', 'Failed to select API key', e);
          }
      }
  };

  // --- Handlers ---

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.relatedTarget === null) {
        setIsDraggingOver(false);
      }
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
      
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const files = Array.from<File>(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
          if (files.length > 0) {
              const dt = new DataTransfer();
              files.forEach(f => dt.items.add(f));
              handleAddFiles(dt.files);
          }
      }
  };

  const handleAddFiles = async (fileList: FileList) => {
    // 1. Snapshot the current options
    const optionsSnapshot = JSON.parse(JSON.stringify(options));
    
    // 2. Pre-calculate variations count
    const permutations = generatePermutations(optionsSnapshot);
    
    // 3. Process each file
    const newJobs: Job[] = [];
    
    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const sourceId = crypto.randomUUID();
        const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
            reader.readAsDataURL(file);
        });

        const previewUrl = URL.createObjectURL(file);
        
        // Store Source Image
        setSourceRegistry(prev => new Map(prev).set(sourceId, {
            id: sourceId,
            file,
            base64Data: base64,
            name: file.name,
            type: file.type,
            previewUrl,
            // analysis: undefined // Analysis happens later or implicitly
        }));

        // Generate N Jobs for this image immediately
        permutations.forEach(combo => {
            newJobs.push({
                id: crypto.randomUUID(),
                sourceImageId: sourceId,
                originalFilename: file.name,
                generatedTitle: "Pending...",
                prompt: buildPromptFromCombo(combo),
                optionsSummary: Object.values(combo).filter(Boolean).join(', '),
                aspectRatio: combo.aspectRatio,
                optionsSnapshot: optionsSnapshot,
                status: 'QUEUED',
                retryCount: 0
            });
        });
        
        // Trigger Analysis in background for this Source Image
        // We don't block job creation, but we update metadata when analysis is done
        analyzeSourceImage(sourceId, base64, file.type);
    }

    setJobQueue(prev => [...prev, ...newJobs]);
    log('INFO', 'Added new jobs to queue', { count: newJobs.length });
  };

  const analyzeSourceImage = async (sourceId: string, base64: string, mimeType: string) => {
      try {
          const analysis = await analyzeImage(base64, mimeType);
          setSourceRegistry(prev => {
              const newMap = new Map(prev);
              const existing = newMap.get(sourceId);
              if (existing) {
                  // Use Object.assign instead of spread to avoid TS error:
                  // "Spread types may only be created from object types"
                  newMap.set(sourceId, Object.assign({}, existing, { analysis }));
              }
              return newMap;
          });
          // Note: We don't automatically update job prompts here because prompts are generated from combo logic.
          // If we wanted to inject analysis into prompt, we'd need to regenerate prompts or inject dynamic placeholders.
          // For now, analysis is for user info and Markdown download.
          log('INFO', 'Background Analysis Complete', { sourceId, title: analysis.title });
          
          // Trigger Markdown Download
          downloadMarkdown(analysis);

      } catch (e) {
          log('WARN', 'Background Analysis Failed', { sourceId, error: e });
      }
  };

  const handleRemoveJob = (id: string) => {
    setJobQueue(prev => prev.filter(j => j.id !== id));
  };

  const handleMoveJob = (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
      setJobQueue(prev => {
          const index = prev.findIndex(j => j.id === id);
          if (index === -1) return prev;
          
          const newQueue = [...prev];
          const item = newQueue.splice(index, 1)[0];
          
          // Find boundary of queued items (don't move into completed/processing if we can avoid complex logic, 
          // but for now we just move in list. Processing filter handles display)
          
          if (direction === 'top') {
              // Move to top of Queued items? Or absolute top?
              // Absolute top is fine, the processor picks from top.
              newQueue.unshift(item);
          } else if (direction === 'bottom') {
              newQueue.push(item);
          } else if (direction === 'up') {
              newQueue.splice(Math.max(0, index - 1), 0, item);
          } else if (direction === 'down') {
              newQueue.splice(Math.min(newQueue.length, index + 1), 0, item);
          }
          
          return newQueue;
      });
  };
  
  const handleZoom = (data: { url: string, title: string, metadata: string }) => {
      setViewedImage(data);
  };

  const autoDownloadImage = (imageUrl: string, prefix: string, optionsSummary: string) => {
      const sanitizedOptions = optionsSummary
        .replace(/, /g, '_')
        .replace(/[^a-z0-9_]/gi, '')
        .substring(0, 100); 
      
      const sanitizedPrefix = prefix.replace(/[^a-z0-9]/gi, '_');
      const filename = `${sanitizedPrefix}_${sanitizedOptions}.png`;
      
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const downloadMarkdown = (analysis: ImageAnalysis) => {
      const blob = new Blob([analysis.markdownContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${analysis.title.replace(/[^a-z0-9]/gi, '_')}_Analysis.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const toggleProcessing = () => {
    if (isProcessing) {
      setIsProcessing(false);
      log('INFO', 'Processing paused by user', {});
    } else {
        if (!apiKeyReady) {
            alert("Please configure your API Key first.");
            handleApiKeySelect();
            return;
        }
        setIsProcessing(true);
    }
  };

  // --- Processing Loop ---
  useEffect(() => {
    if (!isProcessing) return;
    
    const activeWorkers = jobQueue.filter(j => j.status === 'PROCESSING').length;
    
    // Check if we can start more jobs
    if (activeWorkers >= MAX_CONCURRENT_JOBS) return;
    
    // Find next QUEUED job (Top to Bottom)
    const nextJob = jobQueue.find(j => j.status === 'QUEUED');
    
    if (!nextJob) {
        if (activeWorkers === 0) {
            setIsProcessing(false); // All done
        }
        return;
    }

    // Start Job
    runJob(nextJob);

  }, [isProcessing, jobQueue]); // Dependency on jobQueue ensures re-run when status changes

  const runJob = async (job: Job) => {
    // 1. Mark as Processing
    setJobQueue(prev => prev.map(j => j.id === job.id ? { ...j, status: 'PROCESSING' } : j));

    const startTime = Date.now();
    
    try {
        const source = sourceRegistry.get(job.sourceImageId);
        if (!source) throw new Error("Source image not found in registry");

        // Use source analysis title if available, else filename
        const title = source.analysis?.title || source.name;

        const imageUrl = await processImage(source.base64Data, job.prompt, source.type, job.aspectRatio);
        
        const duration = Date.now() - startTime;
        setJobDurations(prev => [...prev.slice(-19), duration]); 

        const generated: GeneratedImage = {
            id: crypto.randomUUID(),
            sourceImageId: job.sourceImageId,
            url: imageUrl,
            prompt: job.prompt,
            optionsUsed: job.optionsSummary,
            originalFilename: job.originalFilename,
            timestamp: Date.now()
        };

        setGeneratedImages(prev => [generated, ...prev]);
        autoDownloadImage(imageUrl, title, job.optionsSummary);
        
        // Remove from Queue upon completion (it moves to Gallery)
        setJobQueue(prev => prev.filter(j => j.id !== job.id));

    } catch (error: any) {
        const currentRetryCount = (job.retryCount || 0) + 1;
        const source = sourceRegistry.get(job.sourceImageId);
        
        const failed: FailedItem = {
            id: crypto.randomUUID(),
            jobId: job.id,
            sourceImageId: job.sourceImageId,
            sourceImagePreview: source?.previewUrl || '',
            optionsSummary: job.optionsSummary,
            error: error.message || "Unknown error",
            originalJob: job,
            retryCount: currentRetryCount
        };
        
        setFailedItems(prev => [failed, ...prev]);
        // Remove from main queue (moves to Failed list)
        setJobQueue(prev => prev.filter(j => j.id !== job.id));
    }
  };

  // --- Retry Handlers ---

  const handleRetry = (item: FailedItem) => {
      if (item.retryCount >= 5) return;
      
      setFailedItems(prev => prev.filter(f => f.id !== item.id));
      
      if (item.originalJob) {
          const retryJob: Job = { ...item.originalJob, retryCount: item.retryCount, status: 'QUEUED' };
          // Add to top of queue for priority? Or bottom?
          // User said "process up to three images... from top to bottom".
          // Usually retries go to end or top. Let's put at top.
          setJobQueue(prev => [retryJob, ...prev]);
          if (!isProcessing) setIsProcessing(true);
      }
  };

  const handleRetryAll = () => {
      const retryableItems = failedItems.filter(f => f.retryCount < 5);
      if (retryableItems.length === 0) return;

      const idsToRetry = new Set(retryableItems.map(f => f.id));
      setFailedItems(prev => prev.filter(f => !idsToRetry.has(f.id)));

      const jobsToRetry = retryableItems
          .filter(f => f.originalJob)
          .map(f => ({ ...f.originalJob!, retryCount: f.retryCount, status: 'QUEUED' } as Job));
      
      setJobQueue(prev => [...prev, ...jobsToRetry]);
      if (!isProcessing) setIsProcessing(true);
  };

  const handleDeleteFailed = (id: string) => {
      setFailedItems(prev => prev.filter(f => f.id !== id));
  };
  
  const handleDeleteGalleryItem = (id: string) => {
      setGeneratedImages(prev => prev.filter(img => img.id !== id));
      // Note: We do not delete source images automatically here, as other jobs might rely on them.
      // If the user wants to clear memory, they can reload the page or we implement explicit cleanup later.
  };

  const handleClearGallery = () => {
      if (generatedImages.length === 0) return;
      setGeneratedImages([]);
  };

  // --- Status Derivation ---
  let currentStatusTitle = 'SYSTEM IDLE';
  let currentStatusDetail = 'Ready to process queue.';

  if (isProcessing) {
    if (processingCount > 0) {
        currentStatusTitle = `GENERATING (${processingCount}/${MAX_CONCURRENT_JOBS})`;
        currentStatusDetail = `Queue: ${activeJobs.length - processingCount} pending`;
    } else if (activeJobs.length > 0) {
            currentStatusTitle = 'PREPARING';
            currentStatusDetail = 'Starting next job...';
    } else {
            currentStatusTitle = 'FINISHING';
            currentStatusDetail = 'Finalizing batch...';
    }
  }

  // --- Gallery Navigation Helpers ---
  const handleNextImage = () => {
    if (!viewedImage || !('id' in viewedImage)) return;
    const idx = generatedImages.findIndex(img => img.id === viewedImage.id);
    if (idx !== -1 && idx < generatedImages.length - 1) {
        setViewedImage(generatedImages[idx + 1]);
    }
  };

  const handlePrevImage = () => {
    if (!viewedImage || !('id' in viewedImage)) return;
    const idx = generatedImages.findIndex(img => img.id === viewedImage.id);
    if (idx > 0) {
        setViewedImage(generatedImages[idx - 1]);
    }
  };

  return (
    <div 
        className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
    >
      {/* Global Drop Zone Overlay */}
      {isDraggingOver && (
          <div className="absolute inset-0 z-50 bg-emerald-900/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-200">
             <div className="p-8 bg-black/50 rounded-2xl border-4 border-dashed border-emerald-500 flex flex-col items-center">
                <Upload size={64} className="text-emerald-400 mb-4 animate-bounce" />
                <h2 className="text-3xl font-bold text-white mb-2">Drop Images Here</h2>
                <p className="text-emerald-200">Add to Processing Queue</p>
             </div>
          </div>
      )}
      
      {/* Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 z-20">
        <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-900/50">
                <span className="text-black font-black text-xl">C</span>
            </div>
            <div>
                <h1 className="font-bold text-lg tracking-tight">ChromaForge</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Katje B.V.</p>
            </div>
        </div>

        {/* Detailed Stats in Header */}
        <div className="hidden lg:flex flex-1 mx-8 bg-slate-800/50 border border-slate-700/50 rounded-lg p-1.5 items-center justify-around text-xs font-mono relative overflow-hidden">
            <div className="flex flex-col items-center leading-none">
                <span className="text-slate-500 text-[9px]">PENDING</span>
                <span className="text-slate-300 font-bold">{activeJobs.length}</span>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <div className="flex flex-col items-center leading-none">
                <span className="text-emerald-500 text-[9px]">COMPLETED</span>
                <span className="text-emerald-400 font-bold">{totalCompleted}</span>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <div className="flex flex-col items-center leading-none">
                <span className="text-slate-500 text-[9px]">ESTIMATED TIME</span>
                <span className="text-amber-400 font-bold flex items-center gap-1">
                    <Clock size={10} />
                    {activeJobs.length > 0 ? formatTime(estimatedRemainingMs) : '00:00'}
                </span>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            
            {/* Status Section */}
            <div className="flex flex-col px-4 flex-1 min-w-[250px]">
                 <div className="flex items-center gap-2 mb-0.5">
                     {isProcessing ? (
                         <Loader2 size={12} className="animate-spin text-amber-500" />
                     ) : (
                         <Activity size={12} className="text-slate-600" />
                     )}
                     <span className={`text-[10px] font-bold uppercase tracking-wider ${isProcessing ? 'text-amber-500' : 'text-slate-500'}`}>
                        {currentStatusTitle}
                     </span>
                 </div>
                 <div className="text-amber-100 text-xs truncate font-mono h-4">
                    {currentStatusDetail}
                 </div>
            </div>
        </div>

        <div className="flex items-center gap-4">
             <button 
               onClick={handleApiKeySelect}
               className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                   apiKeyReady 
                   ? 'bg-slate-800 border-emerald-900 text-emerald-400 hover:bg-slate-700' 
                   : 'bg-amber-900/20 border-amber-900/50 text-amber-500 hover:bg-amber-900/30'
               }`}
             >
                {apiKeyReady ? <ShieldCheck size={14} /> : <Shield size={14} />}
                {apiKeyReady ? 'API Key Active' : 'Set API Key'}
             </button>

             <button
               onClick={toggleProcessing}
               className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold text-sm shadow-lg transition-all ${
                   isProcessing 
                   ? 'bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20' 
                   : 'bg-emerald-600 hover:bg-emerald-500 text-white hover:shadow-emerald-500/20'
               }`}
             >
                 {isProcessing ? (
                     <> <Pause size={16} fill="currentColor" /> Stop </>
                 ) : (
                     <> <Play size={16} fill="currentColor" /> Start Batch </>
                 )}
             </button>

             <div className="w-px h-8 bg-slate-800 mx-2" />

             <button
                onClick={() => setIsManualOpen(true)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="User Manual"
             >
                 <Book size={20} />
             </button>

             <button 
                onClick={() => setIsOptionsOpen(true)} 
                disabled={!globalConfig}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold shadow-lg transition-all border ${
                    globalConfig 
                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500/50' 
                    : 'bg-slate-800 text-slate-500 border-slate-700 cursor-wait'
                }`}
                title="Configuration"
             >
                 <Settings size={18} />
                 <span className="hidden xl:inline">{globalConfig ? 'Configure Generation' : 'Loading Config...'}</span>
             </button>
             <button onClick={() => setIsConsoleOpen(true)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="System Console">
                 <Terminal size={20} />
             </button>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar: Input Jobs */}
        <InputList 
            jobs={jobQueue}
            sourceRegistry={sourceRegistry}
            onAddFiles={handleAddFiles}
            onRemoveJob={handleRemoveJob}
            onMoveJob={handleMoveJob}
            onZoom={handleZoom}
        />

        {/* Center: Gallery */}
        <div className="flex-1 bg-slate-950 flex flex-col min-w-0">
           {/* Info Bar */}
           <div className="h-10 border-b border-slate-800 bg-slate-900 flex items-center px-4 justify-between text-xs text-slate-500">
               <span>
                  Queue: {activeJobs.length} jobs
               </span>
               <div className="flex gap-4">
                   {generatedImages.length > 0 && (
                       <button 
                        onClick={handleClearGallery} 
                        className="flex items-center gap-1 transition-colors cursor-pointer text-slate-400 hover:text-red-400"
                        type="button"
                       >
                           <Trash2 size={12} /> Clear Gallery
                       </button>
                   )}
                   <span>
                      Generated: {generatedImages.length}
                   </span>
               </div>
           </div>
           
           {/* Grid */}
           <div className="flex-1 overflow-y-auto p-6">
                {generatedImages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-700">
                        <div className="w-24 h-24 rounded-full border-4 border-slate-800 flex items-center justify-center mb-4">
                            <Plus size={48} className="opacity-20" />
                        </div>
                        <p>Generated artworks will appear here.</p>
                        <p className="text-xs mt-2 text-slate-600">Drag images anywhere to add them.</p>
                    </div>
                ) : (
                    <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4 pb-20">
                        {generatedImages.map(img => (
                            <div 
                                key={img.id} 
                                className="break-inside-avoid group relative bg-slate-900 rounded-lg overflow-hidden border border-slate-800 shadow-md hover:shadow-emerald-500/10 transition-all cursor-zoom-in"
                                style={{ maxHeight: '40vh' }}
                            >
                                <img 
                                    src={img.url} 
                                    alt="generated" 
                                    className="w-full h-full object-cover block"
                                    style={{ maxHeight: '40vh' }}
                                    loading="lazy"
                                    onClick={() => setViewedImage(img)}
                                />
                                
                                {/* Overlay Details */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end pointer-events-none">
                                    <p className="text-[10px] text-white font-bold mb-0.5">{img.originalFilename}</p>
                                    <p className="text-[9px] text-slate-400 line-clamp-1 mb-2">{img.optionsUsed}</p>
                                    <p className="text-[9px] text-emerald-500 font-mono">Click to zoom</p>
                                </div>

                                {/* Delete Button */}
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteGalleryItem(img.id); }}
                                    className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-all z-10 pointer-events-auto"
                                    title="Delete Result"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
           </div>
        </div>

        {/* Right Sidebar: Failures */}
        <FailedList 
            failedItems={failedItems}
            onRetry={handleRetry}
            onRetryAll={handleRetryAll}
            onDelete={handleDeleteFailed}
            onZoom={handleZoom}
        />
      </main>

      {/* Dialogs */}
      <OptionsDialog 
        isOpen={isOptionsOpen}
        onClose={() => setIsOptionsOpen(false)}
        options={options}
        setOptions={setOptions}
        config={globalConfig}
      />
      
      <ConsoleDialog 
        isOpen={isConsoleOpen}
        onClose={() => setIsConsoleOpen(false)}
      />

      <ManualDialog 
        isOpen={isManualOpen}
        onClose={() => setIsManualOpen(false)}
      />

      <ImageDetailDialog 
        image={viewedImage}
        onClose={() => setViewedImage(null)}
        onNext={handleNextImage}
        onPrev={handlePrevImage}
        hasNext={viewedImage && 'id' in viewedImage ? generatedImages.findIndex(i => i.id === viewedImage.id) < generatedImages.length - 1 : false}
        hasPrev={viewedImage && 'id' in viewedImage ? generatedImages.findIndex(i => i.id === viewedImage.id) > 0 : false}
      />

    </div>
  );
};

export default App;