
import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, Settings, Terminal, Plus, Shield, ShieldCheck, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import InputList from './components/InputList';
import FailedList from './components/FailedList';
import OptionsDialog from './components/OptionsDialog';
import ConsoleDialog from './components/ConsoleDialog';
import ImageDetailDialog from './components/ImageDetailDialog';
import { AppOptions, InputImage, Job, GeneratedImage, FailedItem, ImageAnalysis } from './types';
import { DEFAULT_OPTIONS, MAX_CONCURRENT_JOBS } from './constants';
import { generatePermutations, buildPromptFromCombo } from './utils/combinatorics';
import { processImage, analyzeImage } from './services/geminiService';
import { log } from './services/logger';

const App: React.FC = () => {
  // --- State ---
  const [options, setOptions] = useState<AppOptions>(DEFAULT_OPTIONS);
  const [inputQueue, setInputQueue] = useState<InputImage[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [failedItems, setFailedItems] = useState<FailedItem[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingJobs, setPendingJobs] = useState<Job[]>([]);
  const [processingJobs, setProcessingJobs] = useState<Job[]>([]); // Track active jobs for UI feedback
  
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  
  const [apiKeyReady, setApiKeyReady] = useState(false);

  // Statistics for header
  const totalVariationsScheduled = pendingJobs.length + processingJobs.length + generatedImages.length + failedItems.length;
  const totalCompleted = generatedImages.length;
  const totalFailed = failedItems.length;

  // --- Persistence ---

  useEffect(() => {
    // Load options
    const savedOptions = localStorage.getItem('chromaforge_options');
    if (savedOptions) {
        try {
            setOptions(JSON.parse(savedOptions));
        } catch (e) { console.error('Failed to parse options', e); }
    }

    // Load queue
    const savedQueue = localStorage.getItem('chromaforge_queue');
    if (savedQueue) {
        try {
            const parsedQueue = JSON.parse(savedQueue) as InputImage[];
            // Hydrate queue (re-create simple props, file will be null but base64Data should be there)
            setInputQueue(parsedQueue);
        } catch (e) { console.error('Failed to parse queue', e); }
    }
  }, []);

  useEffect(() => {
      localStorage.setItem('chromaforge_options', JSON.stringify(options));
  }, [options]);

  useEffect(() => {
      try {
          // When saving queue, we need to ensure we keep the base64 data but avoid circular refs
          // InputImage interface already supports base64Data
          localStorage.setItem('chromaforge_queue', JSON.stringify(inputQueue));
      } catch (e) {
          log('WARN', 'LocalStorage Quota Exceeded', { message: 'Could not save image queue persistence. Images might be too large.' });
      }
  }, [inputQueue]);


  // --- Initialization ---
  useEffect(() => {
      // Check for API key status via aistudio helper or env
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

  const handleAddFiles = async (fileList: FileList) => {
    const newInputs: InputImage[] = [];
    
    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
            reader.readAsDataURL(file);
        });

        newInputs.push({
            id: crypto.randomUUID(),
            file: file,
            base64Data: base64,
            name: file.name,
            type: file.type,
            previewUrl: URL.createObjectURL(file),
            status: 'QUEUED',
            totalVariations: 0,
            completedVariations: 0
        });
    }

    setInputQueue(prev => [...prev, ...newInputs]);
    log('INFO', 'Files added to queue', { count: newInputs.length });
  };

  const handleRemoveInput = (id: string) => {
    setInputQueue(prev => prev.filter(i => i.id !== id));
  };

  const generateJobsForInput = (input: InputImage, generatedTitle: string): Job[] => {
    const permutations = generatePermutations(options);
    return permutations.map(combo => ({
      id: crypto.randomUUID(),
      sourceImageId: input.id,
      sourceImagePreview: input.previewUrl,
      originalFilename: input.name,
      generatedTitle: generatedTitle,
      prompt: buildPromptFromCombo(combo),
      optionsSummary: Object.values(combo).join(', '),
      status: 'PENDING'
    }));
  };

  const autoDownloadImage = (imageUrl: string, prefix: string, optionsSummary: string) => {
      // Clean options for filename
      const sanitizedOptions = optionsSummary
        .replace(/, /g, '_')
        .replace(/[^a-z0-9_]/gi, '')
        .substring(0, 100); // Limit length
      
      const sanitizedPrefix = prefix.replace(/[^a-z0-9]/gi, '_');
      const filename = `${sanitizedPrefix}_${sanitizedOptions}.png`;
      
      log('INFO', 'Auto-downloading image', { filename });

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

        // Warning check
        const queuedInputs = inputQueue.filter(i => i.status === 'QUEUED');
        const permutationsCount = generatePermutations(options).length;
        const projectedJobs = queuedInputs.length * permutationsCount;
        
        if (projectedJobs > 50) {
            if (!confirm(`You are about to generate ${projectedJobs} images. This might take a while. Continue?`)) {
                return;
            }
        }

        setIsProcessing(true);
        log('INFO', 'Processing started', {});
    }
  };

  // --- Processing Loop ---
  
  // 1. Analysis Phase & Job Generation
  useEffect(() => {
      if (!isProcessing) return;

      const analyzeNext = async () => {
          // Find first queued item that hasn't been analyzed/converted to jobs
          const nextInput = inputQueue.find(i => i.status === 'QUEUED');
          if (!nextInput) return;

          // Set status to analyzing
          setInputQueue(prev => prev.map(i => i.id === nextInput.id ? { ...i, status: 'ANALYZING' } : i));

          try {
              // Get data (either from file or base64)
              const data = nextInput.file || nextInput.base64Data;
              if (!data) throw new Error("No image data found");

              log('INFO', 'Starting Image Analysis', { id: nextInput.id });
              const analysis = await analyzeImage(data, nextInput.type);
              
              log('INFO', 'Analysis Complete', { title: analysis.title });
              downloadMarkdown(analysis);

              // Add selected options to the bottom of the MD file? 
              // The user requested: "At the bottom, provide a list of selected options for this image."
              // Since the image hasn't been processed with options yet (it will have MANY options),
              // we can't really add *the* selected option. But we can add the permutation configuration.
              // However, the prompt implies "for this image" meaning the variations. 
              // Since the MD is generated once per input image, I will append the *Configuration* used.
              
              // Generate Jobs
              const newJobs = generateJobsForInput(nextInput, analysis.title);
              
              setInputQueue(prev => prev.map(i => i.id === nextInput.id ? { 
                  ...i, 
                  status: 'PROCESSING', 
                  title: analysis.title,
                  analysis,
                  totalVariations: newJobs.length 
              } : i));

              setPendingJobs(prev => [...prev, ...newJobs]);

          } catch (e: any) {
              log('ERROR', 'Analysis Failed', e);
              // Fail the input
              const failed: FailedItem = {
                  id: crypto.randomUUID(),
                  jobId: 'ANALYSIS',
                  sourceImageId: nextInput.id,
                  sourceImagePreview: nextInput.previewUrl,
                  optionsSummary: 'Analysis Phase',
                  error: e.message,
                  originalJob: {} as Job // Mock
              };
              setFailedItems(prev => [failed, ...prev]);
              setInputQueue(prev => prev.filter(i => i.id !== nextInput.id)); // Remove or mark failed? Remove for now.
          }
      };

      // If we have nothing pending but have queued items, try to analyze
      if (pendingJobs.length < MAX_CONCURRENT_JOBS && inputQueue.some(i => i.status === 'QUEUED')) {
          // Check if we are already analyzing one (simple lock via analyzing status check in list)
          if (!inputQueue.some(i => i.status === 'ANALYZING')) {
              analyzeNext();
          }
      }
  }, [isProcessing, inputQueue, pendingJobs.length, options]);


  // 2. Job Execution Phase
  useEffect(() => {
    if (!isProcessing) return;
    
    // Completion Check
    if (pendingJobs.length === 0 && processingJobs.length === 0 && !inputQueue.some(i => i.status === 'QUEUED' || i.status === 'ANALYZING')) {
         const hasProcessingInputs = inputQueue.some(i => i.status === 'PROCESSING');
         if (hasProcessingInputs) {
             setInputQueue(prev => prev.map(i => i.status === 'PROCESSING' ? { ...i, status: 'COMPLETED' } : i));
             setIsProcessing(false);
             log('INFO', 'All jobs completed', {});
         }
         return;
    }

    if (processingJobs.length >= MAX_CONCURRENT_JOBS) return;

    if (pendingJobs.length > 0) {
       const job = pendingJobs[0];
       setPendingJobs(prev => prev.slice(1));
       processJob(job);
    }

  }, [isProcessing, pendingJobs, processingJobs.length, inputQueue]);


  const processJob = async (job: Job) => {
    setProcessingJobs(prev => [...prev, job]);
    
    const input = inputQueue.find(i => i.id === job.sourceImageId);
    if (!input) {
        setProcessingJobs(prev => prev.filter(j => j.id !== job.id));
        return;
    }

    try {
        // Use base64 data if file object is missing (reloaded from storage)
        const data = input.file || input.base64Data;
        if (!data) throw new Error("Image data missing");

        const imageUrl = await processImage(data, job.prompt, input.type);
        
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
        autoDownloadImage(imageUrl, job.generatedTitle, job.optionsSummary);
        
        setInputQueue(prev => prev.map(i => {
            if (i.id === job.sourceImageId) {
                return { ...i, completedVariations: i.completedVariations + 1 };
            }
            return i;
        }));

    } catch (error: any) {
        const failed: FailedItem = {
            id: crypto.randomUUID(),
            jobId: job.id,
            sourceImageId: job.sourceImageId,
            sourceImagePreview: job.sourceImagePreview,
            optionsSummary: job.optionsSummary,
            error: error.message || "Unknown error",
            originalJob: job
        };
        setFailedItems(prev => [failed, ...prev]);
    } finally {
        setProcessingJobs(prev => prev.filter(j => j.id !== job.id));
    }
  };

  // --- Retry Handlers ---

  const handleRetry = (item: FailedItem) => {
      setFailedItems(prev => prev.filter(f => f.id !== item.id));
      setPendingJobs(prev => [item.originalJob, ...prev]);
      if (!isProcessing) setIsProcessing(true);
  };

  const handleRetryAll = () => {
      const jobsToRetry = failedItems.map(f => f.originalJob).filter(j => j.id); // Filter out mock analysis jobs
      setFailedItems([]);
      setPendingJobs(prev => [...prev, ...jobsToRetry]);
      if (!isProcessing) setIsProcessing(true);
  };

  const handleDeleteFailed = (id: string) => {
      setFailedItems(prev => prev.filter(f => f.id !== id));
  };

  const handleClearGallery = () => {
      if (confirm("Are you sure you want to clear all generated images?")) {
          setGeneratedImages([]);
      }
  };
  
  // --- Navigation Helpers ---
  const handleNextImage = () => {
      if (!selectedImage) return;
      const idx = generatedImages.findIndex(img => img.id === selectedImage.id);
      if (idx !== -1 && idx < generatedImages.length - 1) {
          setSelectedImage(generatedImages[idx + 1]);
      }
  };

  const handlePrevImage = () => {
      if (!selectedImage) return;
      const idx = generatedImages.findIndex(img => img.id === selectedImage.id);
      if (idx > 0) {
          setSelectedImage(generatedImages[idx - 1]);
      }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-sans">
      
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
        <div className="hidden lg:flex flex-1 mx-8 bg-slate-800/50 border border-slate-700/50 rounded-lg p-1.5 items-center justify-around text-xs font-mono">
            <div className="flex flex-col items-center leading-none">
                <span className="text-slate-500 text-[9px]">TOTAL VARIANTS</span>
                <span className="text-slate-300 font-bold">{totalVariationsScheduled}</span>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <div className="flex flex-col items-center leading-none">
                <span className="text-emerald-500 text-[9px]">COMPLETED</span>
                <span className="text-emerald-400 font-bold">{totalCompleted}</span>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <div className="flex flex-col items-center leading-none">
                <span className="text-red-500 text-[9px]">FAILED</span>
                <span className="text-red-400 font-bold">{totalFailed}</span>
            </div>
            <div className="w-px h-6 bg-slate-700" />
            <div className="flex flex-col px-4 min-w-[200px] max-w-[400px]">
                <span className="text-amber-500 text-[9px] uppercase">Processing</span>
                <span className="text-amber-300 truncate">
                    {processingJobs.length > 0 ? processingJobs[0].optionsSummary : (isProcessing ? 'Waiting for jobs...' : 'Idle')}
                </span>
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

             <button onClick={() => setIsOptionsOpen(true)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Configuration">
                 <Settings size={20} />
             </button>
             <button onClick={() => setIsConsoleOpen(true)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="System Console">
                 <Terminal size={20} />
             </button>
        </div>
      </header>

      {/* Main Layout */}
      <main className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar: Inputs */}
        <InputList 
            inputs={inputQueue}
            activeJobs={processingJobs}
            onAddFiles={handleAddFiles}
            onRemove={handleRemoveInput}
        />

        {/* Center: Gallery */}
        <div className="flex-1 bg-slate-950 flex flex-col min-w-0">
           {/* Info Bar */}
           <div className="h-10 border-b border-slate-800 bg-slate-925 flex items-center px-4 justify-between text-xs text-slate-500">
               <span>
                  Queue: {pendingJobs.length} jobs
               </span>
               <div className="flex gap-4">
                   {generatedImages.length > 0 && (
                       <button onClick={handleClearGallery} className="flex items-center gap-1 hover:text-red-400 transition-colors">
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
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        {generatedImages.map(img => (
                            <div 
                                key={img.id} 
                                onClick={() => setSelectedImage(img)}
                                className="group relative aspect-square bg-slate-900 rounded-lg overflow-hidden border border-slate-800 shadow-md hover:shadow-emerald-500/10 transition-all cursor-zoom-in"
                            >
                                <img src={img.url} alt="generated" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end pointer-events-none">
                                    <p className="text-[10px] text-white font-bold mb-0.5">{img.originalFilename}</p>
                                    <p className="text-[9px] text-slate-400 line-clamp-1 mb-2">{img.optionsUsed}</p>
                                    <p className="text-[9px] text-emerald-500 font-mono">Click to view & zoom</p>
                                </div>
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
        />
      </main>

      {/* Dialogs */}
      <OptionsDialog 
        isOpen={isOptionsOpen}
        onClose={() => setIsOptionsOpen(false)}
        options={options}
        setOptions={setOptions}
      />
      
      <ConsoleDialog 
        isOpen={isConsoleOpen}
        onClose={() => setIsConsoleOpen(false)}
      />

      <ImageDetailDialog 
        image={selectedImage}
        onClose={() => setSelectedImage(null)}
        onNext={handleNextImage}
        onPrev={handlePrevImage}
        hasNext={selectedImage ? generatedImages.findIndex(i => i.id === selectedImage.id) < generatedImages.length - 1 : false}
        hasPrev={selectedImage ? generatedImages.findIndex(i => i.id === selectedImage.id) > 0 : false}
      />

    </div>
  );
};

export default App;
