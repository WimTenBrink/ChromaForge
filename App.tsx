import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, Settings, Terminal, Plus, Shield, ShieldCheck, Trash2, Loader2, AlertTriangle, Activity, Book, Upload, Clock } from 'lucide-react';
import InputList from './components/InputList';
import FailedList from './components/FailedList';
import OptionsDialog from './components/OptionsDialog';
import ConsoleDialog from './components/ConsoleDialog';
import ImageDetailDialog from './components/ImageDetailDialog';
import ManualDialog from './components/ManualDialog';
import { AppOptions, InputImage, Job, GeneratedImage, FailedItem, ImageAnalysis, GlobalConfig } from './types';
import { DEFAULT_OPTIONS, MAX_CONCURRENT_JOBS } from './constants';
import { generatePermutations, buildPromptFromCombo } from './utils/combinatorics';
import { processImage, analyzeImage } from './services/geminiService';
import { log } from './services/logger';
import { saveQueueToDB, loadQueueFromDB } from './services/db';

const App: React.FC = () => {
  // --- State ---
  const [options, setOptions] = useState<AppOptions>(DEFAULT_OPTIONS);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null);
  
  const [inputQueue, setInputQueue] = useState<InputImage[]>([]);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [failedItems, setFailedItems] = useState<FailedItem[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingJobs, setPendingJobs] = useState<Job[]>([]);
  const [processingJobs, setProcessingJobs] = useState<Job[]>([]); // Track active jobs for UI feedback
  
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Statistics & Timing
  const [jobDurations, setJobDurations] = useState<number[]>([]);

  const getPermutationCount = (opts: AppOptions) => {
    return (Object.keys(opts) as Array<keyof AppOptions>).reduce((acc, key) => {
        const val = opts[key];
        // Only check length for arrays (skip boolean flags)
        if (Array.isArray(val)) {
            const len = val.length;
            return acc * (len > 0 ? len : 1);
        }
        return acc;
    }, 1);
  };

  const permCount = getPermutationCount(options);
  
  // Projection is approximate
  const projectedVariations = inputQueue.reduce((acc, item) => {
      // If item has snapshot, use that, otherwise estimate with current
      if (item.status === 'QUEUED' || item.status === 'ANALYZING') {
          return acc + (item.totalVariations || permCount);
      }
      return acc;
  }, 0);

  const totalVariationsScheduled = projectedVariations + pendingJobs.length + processingJobs.length + generatedImages.length + failedItems.length;
  const totalCompleted = generatedImages.length;
  const totalFailed = failedItems.length;

  // Calculate ETR
  const averageDurationMs = jobDurations.length > 0 
      ? jobDurations.reduce((a, b) => a + b, 0) / jobDurations.length 
      : 15000; // Default estimate 15s

  const remainingItems = pendingJobs.length + processingJobs.length + projectedVariations;
  const estimatedRemainingMs = remainingItems * averageDurationMs;

  const formatTime = (ms: number) => {
      if (remainingItems === 0) return "00:00";
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
            // Merge with default to ensure new keys from potential schema updates are present
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

    // Load queue from DB (Async)
    loadQueueFromDB().then(queue => {
        if (queue && queue.length > 0) {
            // Hydrate queue: Reset stuck statuses
            const sanitizedQueue = queue.map(img => {
                if (img.status === 'ANALYZING' || img.status === 'PROCESSING') {
                    // Reset to queued to allow user to restart processing for these interruptions
                    return { ...img, status: 'QUEUED', completedVariations: 0 } as InputImage;
                }
                return img;
            });
            setInputQueue(sanitizedQueue);
        }
    });
  }, []);

  useEffect(() => {
      localStorage.setItem('chromaforge_options', JSON.stringify(options));
  }, [options]);

  useEffect(() => {
      // Debounce saving queue to DB
      const timer = setTimeout(() => {
          saveQueueToDB(inputQueue);
      }, 500);
      return () => clearTimeout(timer);
  }, [inputQueue]);


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
      // Ensure we are leaving the window, not just entering a child element
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
    // 1. Snapshot the current options so this batch remembers them
    const optionsSnapshot = JSON.parse(JSON.stringify(options));
    
    // 2. Pre-calculate variations count for immediate feedback
    const permutations = generatePermutations(optionsSnapshot);
    const variationCount = permutations.length;

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
            totalVariations: variationCount, // Immediate Feedback: "0 / 4"
            completedVariations: 0,
            optionsSnapshot: optionsSnapshot // Bind configuration to image
        });
    }

    setInputQueue(prev => [...prev, ...newInputs]);
    log('INFO', 'Files added to queue with config snapshot', { count: newInputs.length, variationsPerImage: variationCount });
  };

  const handleRemoveInput = (id: string) => {
    setInputQueue(prev => prev.filter(i => i.id !== id));
    // Remove pending jobs for this input so they don't process
    setPendingJobs(prev => prev.filter(j => j.sourceImageId !== id));
    // Also remove failures related to this input
    setFailedItems(prev => prev.filter(f => f.sourceImageId !== id));
  };

  const handleMoveInput = (id: string, direction: 'up' | 'down' | 'top' | 'bottom') => {
      setInputQueue(prev => {
          const index = prev.findIndex(i => i.id === id);
          if (index === -1) return prev;
          
          const newQueue = [...prev];
          const item = newQueue.splice(index, 1)[0];
          
          if (direction === 'top') {
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

  const handleRerunInput = (id: string) => {
      const input = inputQueue.find(i => i.id === id);
      if (!input) return;

      log('INFO', 'Rerunning input', { id, name: input.name });

      // Note: Rerun keeps the original options snapshot. 
      setInputQueue(prev => prev.map(i => i.id === id ? {
          ...i,
          status: 'QUEUED',
          completedVariations: 0,
      } : i));

      // Remove failures associated with this input
      setFailedItems(prev => prev.filter(f => f.sourceImageId !== id));

      if (!isProcessing) setIsProcessing(true);
  };

  const generateJobsForInput = (input: InputImage, generatedTitle: string): Job[] => {
    // Generate permutations using the SNAPSHOT options saved with the input
    const optionsToUse = input.optionsSnapshot || options;
    const permutations = generatePermutations(optionsToUse);
    
    return permutations.map(combo => ({
      id: crypto.randomUUID(),
      sourceImageId: input.id,
      sourceImagePreview: input.previewUrl,
      originalFilename: input.name,
      generatedTitle: generatedTitle,
      prompt: buildPromptFromCombo(combo),
      optionsSummary: Object.values(combo).filter(Boolean).join(', '),
      aspectRatio: combo.aspectRatio,
      status: 'PENDING',
      retryCount: 0
    }));
  };

  const addJobsSafely = (newJobs: Job[]) => {
      setPendingJobs(prev => {
          // Deduplication Logic
          const existingSignatures = new Set();
          
          prev.forEach(j => existingSignatures.add(`${j.sourceImageId}|${j.optionsSummary}`));
          processingJobs.forEach(j => existingSignatures.add(`${j.sourceImageId}|${j.optionsSummary}`));
          generatedImages.forEach(g => existingSignatures.add(`${g.sourceImageId}|${g.optionsUsed}`));
          failedItems.forEach(f => existingSignatures.add(`${f.sourceImageId}|${f.optionsSummary}`));

          const uniqueJobs = newJobs.filter(j => {
              const sig = `${j.sourceImageId}|${j.optionsSummary}`;
              if (existingSignatures.has(sig)) {
                  log('WARN', 'Skipping duplicate job', { sig });
                  return false;
              }
              return true;
          });
          
          return [...prev, ...uniqueJobs];
      });
  };

  const autoDownloadImage = (imageUrl: string, prefix: string, optionsSummary: string) => {
      const sanitizedOptions = optionsSummary
        .replace(/, /g, '_')
        .replace(/[^a-z0-9_]/gi, '')
        .substring(0, 100); 
      
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

        setIsProcessing(true);
        log('INFO', 'Processing started', { queued: inputQueue.filter(i => i.status === 'QUEUED').length });
    }
  };

  // --- Processing Loop ---
  
  // 1. Analysis Phase & Job Generation
  useEffect(() => {
      if (!isProcessing) return;

      const analyzeNext = async () => {
          const nextInput = inputQueue.find(i => i.status === 'QUEUED');
          if (!nextInput) return;

          // Check if analysis already exists (Rerun scenario)
          if (nextInput.analysis) {
               log('INFO', 'Skipping Analysis (Cached)', { id: nextInput.id });
               const newJobs = generateJobsForInput(nextInput, nextInput.title || 'Untitled');
               setInputQueue(prev => prev.map(i => i.id === nextInput.id ? { 
                  ...i, 
                  status: 'PROCESSING',
                  totalVariations: newJobs.length 
               } : i));
               addJobsSafely(newJobs);
               return; 
          }

          // Normal path: Analyze first
          setInputQueue(prev => prev.map(i => i.id === nextInput.id ? { ...i, status: 'ANALYZING' } : i));

          try {
              const data = nextInput.file || nextInput.base64Data;
              if (!data) throw new Error("No image data found");

              log('INFO', 'Starting Image Analysis', { id: nextInput.id });
              const analysis = await analyzeImage(data, nextInput.type);
              
              log('INFO', 'Analysis Complete', { title: analysis.title });
              downloadMarkdown(analysis); 

              const newJobs = generateJobsForInput(nextInput, analysis.title);
              
              setInputQueue(prev => prev.map(i => i.id === nextInput.id ? { 
                  ...i, 
                  status: 'PROCESSING', 
                  title: analysis.title,
                  analysis,
                  totalVariations: newJobs.length 
               } : i));

              addJobsSafely(newJobs);

          } catch (e: any) {
              log('ERROR', 'Analysis Failed', e);
              const failed: FailedItem = {
                  id: crypto.randomUUID(),
                  jobId: 'ANALYSIS',
                  sourceImageId: nextInput.id,
                  sourceImagePreview: nextInput.previewUrl,
                  optionsSummary: 'Analysis Phase',
                  error: e.message,
                  retryCount: 0
              };
              setFailedItems(prev => [failed, ...prev]);
              setInputQueue(prev => prev.map(i => i.id === nextInput.id ? { ...i, status: 'FAILED' } : i));
          }
      };

      const isAnyImageActive = inputQueue.some(i => i.status === 'ANALYZING' || i.status === 'PROCESSING');
      if (!isAnyImageActive && inputQueue.some(i => i.status === 'QUEUED')) {
          analyzeNext();
      }

  }, [isProcessing, inputQueue, pendingJobs.length, options]);


  // 2. Job Execution Phase
  useEffect(() => {
    if (!isProcessing) return;
    
    // Check for completion of active processing inputs (for sequential flow)
    const activeProcessingInputs = inputQueue.filter(i => i.status === 'PROCESSING');
    
    if (activeProcessingInputs.length > 0 && pendingJobs.length === 0 && processingJobs.length === 0) {
         setInputQueue(prev => prev.map(i => {
             if (i.status === 'PROCESSING') {
                 const hasFailures = failedItems.some(f => f.sourceImageId === i.id);
                 return { ...i, status: hasFailures ? 'PARTIAL' : 'COMPLETED' };
             }
             return i;
         }));
         return;
    }

    // Check if entire batch is done
    if (pendingJobs.length === 0 && processingJobs.length === 0 && !inputQueue.some(i => i.status === 'QUEUED' || i.status === 'ANALYZING' || i.status === 'PROCESSING')) {
         setIsProcessing(false);
         log('INFO', 'All jobs finished', {});
         return;
    }

    if (processingJobs.length >= MAX_CONCURRENT_JOBS) return;

    if (pendingJobs.length > 0) {
       const job = pendingJobs[0];
       setPendingJobs(prev => prev.slice(1));
       processJob(job);
    }

  }, [isProcessing, pendingJobs, processingJobs.length, inputQueue, failedItems]);


  const processJob = async (job: Job) => {
    setProcessingJobs(prev => [...prev, job]);
    const startTime = Date.now();
    
    const input = inputQueue.find(i => i.id === job.sourceImageId);
    if (!input) {
        setProcessingJobs(prev => prev.filter(j => j.id !== job.id));
        return;
    }

    try {
        const data = input.file || input.base64Data;
        if (!data) throw new Error("Image data missing");

        const imageUrl = await processImage(data, job.prompt, input.type, job.aspectRatio);
        
        const duration = Date.now() - startTime;
        setJobDurations(prev => [...prev.slice(-19), duration]); // Keep last 20 timings

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
        const currentRetryCount = (job.retryCount || 0) + 1;
        const failed: FailedItem = {
            id: crypto.randomUUID(),
            jobId: job.id,
            sourceImageId: job.sourceImageId,
            sourceImagePreview: job.sourceImagePreview,
            optionsSummary: job.optionsSummary,
            error: error.message || "Unknown error",
            originalJob: job,
            retryCount: currentRetryCount
        };
        setFailedItems(prev => [failed, ...prev]);
    } finally {
        setProcessingJobs(prev => prev.filter(j => j.id !== job.id));
    }
  };

  // --- Retry Handlers ---

  const handleRetry = (item: FailedItem) => {
      if (item.retryCount >= 5) {
          log('WARN', 'Max retries reached for item', { id: item.id });
          return;
      }
      setFailedItems(prev => prev.filter(f => f.id !== item.id));
      
      if (item.jobId === 'ANALYSIS') {
          setInputQueue(prev => prev.map(i => i.id === item.sourceImageId ? { ...i, status: 'QUEUED' } : i));
          if (!isProcessing) setIsProcessing(true);
      } else if (item.originalJob) {
          const retryJob: Job = { ...item.originalJob, retryCount: item.retryCount };
          setPendingJobs(prev => [retryJob, ...prev]);
          setInputQueue(prev => prev.map(i => i.id === item.sourceImageId ? { ...i, status: 'PROCESSING' } : i));
          if (!isProcessing) setIsProcessing(true);
      }
  };

  const handleRetryAll = () => {
      const retryableItems = failedItems.filter(f => f.retryCount < 5);
      if (retryableItems.length === 0) return;

      const analysisFailures = retryableItems.filter(f => f.jobId === 'ANALYSIS');
      const jobFailures = retryableItems.filter(f => f.jobId !== 'ANALYSIS' && f.originalJob);
      
      const idsToRetry = new Set(retryableItems.map(f => f.id));
      setFailedItems(prev => prev.filter(f => !idsToRetry.has(f.id)));

      if (analysisFailures.length > 0) {
          const ids = new Set(analysisFailures.map(f => f.sourceImageId));
          setInputQueue(prev => prev.map(i => ids.has(i.id) ? { ...i, status: 'QUEUED' } : i));
      }

      if (jobFailures.length > 0) {
          const jobsToRetry = jobFailures.map(f => ({ ...f.originalJob!, retryCount: f.retryCount }));
          setPendingJobs(prev => [...prev, ...jobsToRetry]);
          const affectedInputIds = new Set(jobsToRetry.map(j => j.sourceImageId));
          setInputQueue(prev => prev.map(i => affectedInputIds.has(i.id) ? { ...i, status: 'PROCESSING' } : i));
      }

      if (!isProcessing) setIsProcessing(true);
  };

  const handleDeleteFailed = (id: string) => {
      setFailedItems(prev => prev.filter(f => f.id !== id));
  };

  const handleClearGallery = () => {
      if (generatedImages.length === 0) return;
      setGeneratedImages([]);
      log('INFO', 'Gallery cleared by user (No confirm)', {});
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

  // --- Status Derivation ---
  let currentStatusTitle = 'SYSTEM IDLE';
  let currentStatusDetail = 'Ready to process queue.';

  if (isProcessing) {
    const analyzing = inputQueue.find(i => i.status === 'ANALYZING');
    if (analyzing) {
        currentStatusTitle = 'ANALYZING IMAGE';
        currentStatusDetail = `Detecting objects & safety in "${analyzing.name}"...`;
    } else if (processingJobs.length > 0) {
        currentStatusTitle = `GENERATING (${processingJobs.length} active)`;
        currentStatusDetail = `Rendering: ${processingJobs[0].optionsSummary}`;
    } else if (inputQueue.some(i => i.status === 'QUEUED')) {
            currentStatusTitle = 'PREPARING';
            currentStatusDetail = 'Loading next item...';
    } else {
            currentStatusTitle = 'FINISHING';
            currentStatusDetail = 'Finalizing batch...';
    }
  }

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
                <span className="text-slate-500 text-[9px]">ESTIMATED TIME</span>
                <span className="text-amber-400 font-bold flex items-center gap-1">
                    <Clock size={10} />
                    {remainingItems > 0 ? formatTime(estimatedRemainingMs) : '00:00'}
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
        
        {/* Left Sidebar: Inputs */}
        <InputList 
            inputs={inputQueue}
            activeJobs={processingJobs}
            onAddFiles={handleAddFiles}
            onRemove={handleRemoveInput}
            onRerun={handleRerunInput}
            onMove={handleMoveInput}
        />

        {/* Center: Gallery */}
        <div className="flex-1 bg-slate-950 flex flex-col min-w-0">
           {/* Info Bar */}
           <div className="h-10 border-b border-slate-800 bg-slate-900 flex items-center px-4 justify-between text-xs text-slate-500">
               <span>
                  Queue: {pendingJobs.length} jobs
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
                    <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 space-y-4 pb-20">
                        {generatedImages.map(img => (
                            <div 
                                key={img.id} 
                                onClick={() => setSelectedImage(img)}
                                className="break-inside-avoid group relative bg-slate-900 rounded-lg overflow-hidden border border-slate-800 shadow-md hover:shadow-emerald-500/10 transition-all cursor-zoom-in"
                            >
                                <img 
                                    src={img.url} 
                                    alt="generated" 
                                    className="w-full h-auto block"
                                    loading="lazy"
                                />
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