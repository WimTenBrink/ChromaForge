import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Play, Pause, Settings, Terminal, Shield, ShieldCheck, Trash2, Loader2, Activity, Book, Upload, Plus, Search, RefreshCw, ArrowUpCircle, ArrowDownCircle, ArrowUp, ArrowDown, Calendar, Type, LayoutList, Grip, Monitor, XCircle, Layers, Image as ImageIcon, ScanSearch, Ban, FileImage } from 'lucide-react';
import Sidebar from './components/Sidebar';
import OptionsDialog from './components/OptionsDialog';
import ConsoleDialog from './components/ConsoleDialog';
import ImageDetailDialog from './components/ImageDetailDialog';
import ManualDialog from './components/ManualDialog';
import JobDetailDialog from './components/JobDetailDialog';
import { AppOptions, Job, GeneratedImage, FailedItem, ImageAnalysis, GlobalConfig, SourceImage, ValidationJob, SidebarTab, JobLogEntry } from './types';
import { DEFAULT_OPTIONS } from './constants';
import { generatePermutations, buildPromptFromCombo } from './utils/combinatorics';
import { processImage, validateFileName } from './services/geminiService';
import { log } from './services/logger';
import { saveState, loadState } from './services/db';

const App: React.FC = () => {
  // --- State ---
  const [options, setOptions] = useState<AppOptions>(DEFAULT_OPTIONS);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null);
  
  // Data Store
  const [sourceRegistry, setSourceRegistry] = useState<Map<string, SourceImage>>(new Map());
  const [validationQueue, setValidationQueue] = useState<ValidationJob[]>([]);
  const [jobQueue, setJobQueue] = useState<Job[]>([]); // The main queue (Queued, Processing, Completed)
  
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [failedItems, setFailedItems] = useState<FailedItem[]>([]);
  
  // Filtering & Sorting
  const [selectedSourceIds, setSelectedSourceIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'TIMESTAMP' | 'FILENAME' | 'QUEUE'>('TIMESTAMP');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');
  const [thumbnailSize, setThumbnailSize] = useState<'SMALL' | 'MEDIUM' | 'LARGE'>('SMALL');

  const [isProcessing, setIsProcessing] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('UPLOADS');
  const [sidebarWidth, setSidebarWidth] = useState(20);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  // View Viewer (Zoom)
  const [viewedImage, setViewedImage] = useState<GeneratedImage | { url: string, title: string, metadata: string } | null>(null);
  const [viewedJob, setViewedJob] = useState<Job | FailedItem | null>(null);
  
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);

  const galleryScrollRef = useRef<HTMLDivElement>(null);

  // Statistics & Timing
  const [jobDurations, setJobDurations] = useState<number[]>([]);

  // Derived Statistics
  const activeJobs = jobQueue.filter(j => j.status === 'QUEUED' || j.status === 'PROCESSING');
  const processingJobs = jobQueue.filter(j => j.status === 'PROCESSING');
  const processingCount = processingJobs.length;
  
  const totalVariationsScheduled = jobQueue.length + generatedImages.length + failedItems.length;
  const totalProcessed = generatedImages.length + failedItems.length;
  const progressPercentage = totalVariationsScheduled === 0 ? 0 : Math.round((totalProcessed / totalVariationsScheduled) * 100);

  // Counts for Tabs
  const uploadsCount = sourceRegistry.size;
  const validationCount = validationQueue.length;
  const jobsCount = processingCount;
  const queueCount = jobQueue.filter(j => j.status === 'QUEUED').length;
  
  // Calculate Failed/Blocked counts based on configurable limits
  // Note: Sidebar will merge these into "Failed" tab now.
  const { failedCount, blockedCount } = useMemo(() => {
    let f = 0, b = 0;
    failedItems.forEach(item => {
      const isSafety = item.error.toLowerCase().includes('prohibited') || item.error.toLowerCase().includes('safety') || item.error.toLowerCase().includes('blocked');
      const maxRetries = isSafety ? options.safetyRetryLimit : options.retryLimit;
      if (item.retryCount >= maxRetries) b++;
      else f++;
    });
    return { failedCount: f, blockedCount: b };
  }, [failedItems, options.retryLimit, options.safetyRetryLimit]);

  const sidebarTabs: { id: SidebarTab; label: string; icon: React.ElementType; count: number; color: string }[] = [
    { id: 'UPLOADS', label: 'Upload', icon: ImageIcon, count: uploadsCount, color: 'text-violet-400' },
    { id: 'VALIDATING', label: 'Check', icon: ScanSearch, count: validationCount, color: 'text-purple-400' },
    { id: 'JOBS', label: 'Jobs', icon: Loader2, count: jobsCount, color: 'text-amber-400' },
    { id: 'QUEUE', label: 'Queue', icon: Layers, count: queueCount, color: 'text-blue-400' },
    { id: 'FAILED', label: 'Failed', icon: RefreshCw, count: failedCount + blockedCount, color: 'text-orange-400' },
  ];

  // --- Resize Logic ---
  const startResizing = useCallback(() => setIsResizingSidebar(true), []);
  const stopResizing = useCallback(() => setIsResizingSidebar(false), []);
  
  const resize = useCallback((e: MouseEvent) => {
      if (isResizingSidebar) {
          let newWidth = (e.clientX / window.innerWidth) * 100;
          if (newWidth < 10) newWidth = 10;
          if (newWidth > 50) newWidth = 50;
          setSidebarWidth(newWidth);
      }
  }, [isResizingSidebar]);

  useEffect(() => {
      if (isResizingSidebar) {
          window.addEventListener('mousemove', resize);
          window.addEventListener('mouseup', stopResizing);
      }
      return () => {
          window.removeEventListener('mousemove', resize);
          window.removeEventListener('mouseup', stopResizing);
      };
  }, [isResizingSidebar, resize, stopResizing]);

  // --- Persistence ---

  useEffect(() => {
    // Load options from localStorage
    const savedOptions = localStorage.getItem('chromaforge_options');
    if (savedOptions) {
        try {
            const parsed = JSON.parse(savedOptions);
            setOptions({ ...DEFAULT_OPTIONS, ...(parsed as object) });
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

    // Load Queue from DB
    loadState().then(({ jobs, sources }) => {
        if (jobs.length > 0 || sources.size > 0) {
            setJobQueue(jobs);
            setSourceRegistry(sources);
            log('INFO', 'Restored previous session', { jobs: jobs.length, sources: sources.size });
        }
        setIsRestoring(false);
    });
  }, []);

  useEffect(() => {
      localStorage.setItem('chromaforge_options', JSON.stringify(options));
  }, [options]);

  // Persist Queue Changes to DB
  useEffect(() => {
      if (isRestoring) return;
      
      const timer = setTimeout(() => {
          saveState(jobQueue, sourceRegistry);
      }, 1000); // Debounce saves
      
      return () => clearTimeout(timer);
  }, [jobQueue, sourceRegistry, isRestoring]);

  // --- Garbage Collector (Memory Management) ---
  // Periodically checks for orphans and removes them to free up memory
  useEffect(() => {
      if (isRestoring) return;
      
      const sweeper = setInterval(() => {
          setSourceRegistry((prev: Map<string, SourceImage>) => {
              const next = new Map(prev);
              let changed = false;
              
              for (const [id, src] of prev.entries()) {
                  // Check if this source ID is referenced anywhere
                  const inValidation = validationQueue.some(v => v.sourceImageId === id);
                  const inJobs = jobQueue.some(j => j.sourceImageId === id);
                  const inFailed = failedItems.some(f => f.sourceImageId === id);
                  const inGallery = generatedImages.some(g => g.sourceImageId === id);

                  // If source is not being processed, not waiting, and has no results
                  if (!inValidation && !inJobs && !inFailed && !inGallery) {
                      // MEMORY CLEANUP: Revoke object URL
                      if (src.previewUrl) {
                          URL.revokeObjectURL(src.previewUrl);
                      }
                      next.delete(id);
                      changed = true;
                      log('INFO', 'Garbage Collector cleaned orphan source', { id: src.id, name: src.name });
                  }
              }
              return changed ? next : prev;
          });
      }, 5000); // Run every 5 seconds

      return () => clearInterval(sweeper);
  }, [validationQueue, jobQueue, failedItems, generatedImages, isRestoring]);


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
    
    // 2. Add to Validation Queue first
    const newValidationJobs: ValidationJob[] = [];
    const currentSources: SourceImage[] = Array.from(sourceRegistry.values());
    
    // Maintain a local set of filenames added in this batch to prevent instant duplicates within batch
    const processedNames = new Set(currentSources.map(s => s.originalUploadName));

    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        
        // Check duplicate against existing or newly processed in this batch
        if (processedNames.has(file.name)) {
            // It's a duplicate. Find the ID if it exists in currentSources.
            // If it was just added in this batch (not in currentSources yet), we might miss the ID update
            // but we still prevent adding it again to validation queue.
            const duplicate = currentSources.find((s: SourceImage) => s.originalUploadName === file.name);
            
            if (duplicate) {
                const duplicateId = duplicate.id;
                setSourceRegistry((prev: Map<string, SourceImage>) => {
                    const next = new Map(prev);
                    const existing = next.get(duplicateId);
                    if (existing) {
                        next.set(duplicateId, {
                            ...existing,
                            duplicateCount: (existing.duplicateCount || 0) + 1
                        });
                    }
                    return next;
                });
                log('INFO', 'Duplicate upload detected (incremented count)', { fileName: file.name });
            } else {
                 log('INFO', 'Duplicate upload ignored (same batch)', { fileName: file.name });
            }
            continue;
        }

        processedNames.add(file.name);

        const sourceId = crypto.randomUUID();
        const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve((e.target?.result as string).split(',')[1]);
            reader.readAsDataURL(file);
        });

        const previewUrl = URL.createObjectURL(file);
        
        // Store Source Image with VALIDATING status
        setSourceRegistry(prev => new Map(prev).set(sourceId, {
            id: sourceId,
            file,
            originalUploadName: file.name, // Track original name
            base64Data: base64,
            name: "Analyzing...", // Placeholder
            type: file.type,
            previewUrl,
            status: 'VALIDATING',
            activityLog: [],
            duplicateCount: 0,
            priorityCount: 0
        }));

        newValidationJobs.push({
            id: crypto.randomUUID(),
            sourceImageId: sourceId,
            file: file,
            optionsSnapshot: optionsSnapshot
        });
    }

    if (newValidationJobs.length > 0) {
        setValidationQueue(prev => [...prev, ...newValidationJobs]);
        log('INFO', 'Added files to validation queue', { count: newValidationJobs.length });
    }
  };

  // --- Validation Loop ---
  useEffect(() => {
    if (validationQueue.length === 0 || isValidating) return;
    if (!apiKeyReady && validationQueue.length > 0) return; // Wait for key

    const validateNext = async () => {
        setIsValidating(true);
        const job = validationQueue[0];
        try {
             log('INFO', 'Validating File Name', { sourceId: job.sourceImageId });
             const generatedName = await validateFileName(job.file);
             
             // Update source registry
             setSourceRegistry(prev => {
                 const newMap = new Map(prev);
                 const src = newMap.get(job.sourceImageId);
                 if (src) {
                     newMap.set(job.sourceImageId, {
                         ...(src as SourceImage),
                         name: generatedName,
                         status: 'READY'
                     });
                 }
                 return newMap;
             });

             // Generate Permutations and Jobs
             // Pass globalConfig to enable smart grouping
             const permutations = generatePermutations(job.optionsSnapshot, globalConfig);
             const newJobs: Job[] = [];
             
             permutations.forEach((combo, index) => {
                const summaryParts = Object.entries(combo)
                    .filter(([key, value]) => {
                        if (key === 'combinedGroups' || key === 'optionsSnapshot' || key === 'removeCharacters' || key === 'replaceBackground') return false;
                        if (!value) return false;
                        const valStr = String(value);
                        return !valStr.startsWith("As-Is") && valStr !== "Original" && valStr !== "default" && valStr !== "none";
                    })
                    .map(([key, value]) => {
                        const label = key.replace(/([A-Z])/g, " $1").replace(/^./, str => str.toUpperCase());
                        return `${label}: ${value}`;
                    });
                
                if (combo.removeCharacters) summaryParts.unshift("NO CHARACTERS");
                if (combo.replaceBackground) summaryParts.unshift("REPLACE BG");

                // Append index number to filename if multiple jobs
                const displayFilename = permutations.length > 1 
                    ? `${generatedName}_${(index + 1).toString().padStart(3, '0')}`
                    : generatedName;
                
                // Prepare clean name for prompt injection and D&D Cards
                // Capitalize properly: _elf-warrior -> Elf Warrior
                // This name will be used as the Character Name in the prompt for D&D sheets
                const promptName = generatedName.replace(/^_/, '').split(/[-_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').trim();

                newJobs.push({
                    id: crypto.randomUUID(),
                    sourceImageId: job.sourceImageId,
                    originalFilename: displayFilename,
                    generatedTitle: "Pending...",
                    prompt: buildPromptFromCombo(combo, promptName),
                    optionsSummary: summaryParts.join(', '),
                    aspectRatio: combo.aspectRatio,
                    optionsSnapshot: job.optionsSnapshot,
                    status: 'QUEUED',
                    retryCount: 0
                });
            });

            setJobQueue(prev => [...prev, ...newJobs]);
            log('INFO', 'Validation Complete. Jobs Created.', { sourceId: job.sourceImageId, jobCount: newJobs.length });

        } catch (e) {
            log('ERROR', 'Validation Failed', { error: e });
            // Even if validation fails, we might want to proceed with original name? 
            // For now, let's just mark it ready with original name
            setSourceRegistry(prev => {
                const newMap = new Map(prev);
                const src = newMap.get(job.sourceImageId);
                if (src) {
                    newMap.set(job.sourceImageId, { ...(src as SourceImage), status: 'READY' });
                }
                return newMap;
            });
        } finally {
            // Remove from validation queue
            setValidationQueue(prev => prev.slice(1));
            setIsValidating(false);
        }
    };

    validateNext();
  }, [validationQueue, isValidating, apiKeyReady, globalConfig]);


  const handleRemoveJob = (id: string) => {
    setJobQueue(prev => prev.filter(j => j.id !== id));
  };
  
  const handlePrioritizeSource = (sourceId: string) => {
    setJobQueue(prev => {
        // Separate jobs for this source and others
        const sourceJobs = prev.filter(j => j.sourceImageId === sourceId);
        const otherJobs = prev.filter(j => j.sourceImageId !== sourceId);
        // Put source jobs first (FIFO relative to each other)
        // This ensures the selected source's jobs are executed next
        return [...sourceJobs, ...otherJobs];
    });

    // NEW: Increment priority count
    setSourceRegistry((prev) => {
        const next = new Map<string, SourceImage>(prev);
        const src = next.get(sourceId);
        if (src) {
            next.set(sourceId, { ...src, priorityCount: (src.priorityCount || 0) + 1 });
        }
        return next;
    });

    log('INFO', 'Prioritized source', { sourceId });
  };

  const autoDownloadImage = (imageUrl: string, originalFilename: string) => {
      try {
          // Robust extension detection from Base64 MIME
          const mimeMatch = imageUrl.match(/data:(image\/[a-zA-Z+]+);base64,/);
          let mime = mimeMatch ? mimeMatch[1] : 'image/png';
          let ext = 'png';
          if (mime === 'image/jpeg') ext = 'jpg';
          if (mime === 'image/webp') ext = 'webp';

          // Convert to Blob for reliable large file download
          const base64Data = imageUrl.split(',')[1];
          const byteCharacters = atob(base64Data);
          const byteArrays = [];
          
          for (let offset = 0; offset < byteCharacters.length; offset += 512) {
              const slice = byteCharacters.slice(offset, offset + 512);
              const byteNumbers = new Array(slice.length);
              for (let i = 0; i < slice.length; i++) {
                  byteNumbers[i] = slice.charCodeAt(i);
              }
              const byteArray = new Uint8Array(byteNumbers);
              byteArrays.push(byteArray);
          }
          
          const blob = new Blob(byteArrays, { type: mime });
          const url = URL.createObjectURL(blob);

          const link = document.createElement('a');
          link.href = url;
          link.download = `${originalFilename}.${ext}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Cleanup URL object
          setTimeout(() => URL.revokeObjectURL(url), 1000);

      } catch (e) {
          console.error("Auto-download failed", e);
          // Simple Fallback
          const link = document.createElement('a');
          link.href = imageUrl;
          link.download = `${originalFilename}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      }
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
    
    // Check if we can start more jobs (based on options.concurrentJobs)
    if (activeWorkers >= options.concurrentJobs) return;
    
    // Find next QUEUED job (Top to Bottom - FIFO)
    const nextJob = jobQueue.find(j => j.status === 'QUEUED');
    
    if (!nextJob) {
        if (activeWorkers === 0 && validationQueue.length === 0) {
            setIsProcessing(false); // All done
        }
        return;
    }

    // Start Job
    runJob(nextJob);

  }, [isProcessing, jobQueue, options.concurrentJobs]); // Dependency on jobQueue ensures re-run when status changes

  const runJob = async (job: Job) => {
    // 1. Mark as Processing
    setJobQueue(prev => prev.map(j => j.id === job.id ? { ...j, status: 'PROCESSING' } : j));

    const startTime = Date.now();
    
    try {
        const source = sourceRegistry.get(job.sourceImageId);
        if (!source) throw new Error("Source image not found in registry");

        // Use source analysis title if available, else filename
        const title = source.analysis?.title || source.name;

        // Use snapshot options to ensure the job runs with the settings present at creation time
        // This prevents race conditions where changing global settings affects running jobs
        const targetFormat = job.optionsSnapshot?.outputFormat || options.outputFormat || 'image/png';
        const targetQuality = job.optionsSnapshot?.imageQuality || options.imageQuality || '4K';

        // Pass snapshot preferences to processImage
        const imageUrl = await processImage(
            source.base64Data, 
            job.prompt, 
            source.type, 
            job.aspectRatio, 
            targetFormat, 
            targetQuality
        );
        
        const duration = Date.now() - startTime;
        setJobDurations(prev => [...prev.slice(-19), duration]); 

        const generated: GeneratedImage = {
            id: crypto.randomUUID(),
            sourceImageId: job.sourceImageId,
            url: imageUrl,
            prompt: job.prompt,
            optionsUsed: job.optionsSummary,
            originalFilename: job.originalFilename,
            timestamp: Date.now(),
            optionsSnapshot: job.optionsSnapshot
        };
        
        // Log activity to source history
        const logEntry: JobLogEntry = {
            jobId: job.id,
            timestamp: new Date().toISOString(),
            sourceFilename: source.originalUploadName || source.name,
            generatedFilename: `${job.originalFilename}.${imageUrl.includes('image/jpeg') ? 'jpg' : 'png'}`,
            prompt: job.prompt,
            optionsDescription: job.optionsSummary
        };

        setSourceRegistry(prev => {
            const next = new Map<string, SourceImage>(prev);
            const s = next.get(job.sourceImageId);
            if (s) {
                next.set(job.sourceImageId, {
                    ...s,
                    activityLog: [...(s.activityLog || []), logEntry]
                });
            }
            return next;
        });

        setGeneratedImages(prev => [generated, ...prev]);
        autoDownloadImage(imageUrl, job.originalFilename);
        
        // Remove from Queue upon completion (it moves to Gallery)
        setJobQueue(prev => {
            const remaining = prev.filter(j => j.id !== job.id);
            return remaining;
        });

    } catch (error: any) {
        // NEW: Unresponsive Check / Timeout Backoff
        const errMsg = error.message?.toLowerCase() || '';
        if (errMsg.includes('timed out') || errMsg.includes('503') || errMsg.includes('overloaded')) {
             setOptions(prev => {
                 if (prev.concurrentJobs > 3) {
                     log('WARN', 'System unresponsive. Reducing concurrency.', { from: prev.concurrentJobs, to: prev.concurrentJobs - 1 });
                     return { ...prev, concurrentJobs: prev.concurrentJobs - 1 };
                 }
                 return prev;
             });
        }

        const currentRetryCount = (job.retryCount || 0);
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
        setJobQueue(prev => {
            const remaining = prev.filter(j => j.id !== job.id);
            return remaining;
        });
    }
  };

  // --- Repeat Job Logic ---
  const handleRepeatJob = (img: GeneratedImage) => {
      // Reconstruct job from GeneratedImage info
      const sourceId = img.sourceImageId;
      const jobOptions = img.optionsSnapshot;

      if (!sourceId || !jobOptions) {
          log('WARN', 'Cannot repeat job: missing source or options', {});
          return;
      }
      
      const newJob: Job = {
        id: crypto.randomUUID(),
        sourceImageId: sourceId,
        originalFilename: img.originalFilename,
        generatedTitle: "Repeated Job",
        prompt: img.prompt,
        optionsSummary: img.optionsUsed,
        aspectRatio: undefined, 
        optionsSnapshot: jobOptions,
        status: 'QUEUED',
        retryCount: 0
      };

      // Add to END of queue (Append)
      setJobQueue(prev => [...prev, newJob]);
      
      if (!isProcessing) setIsProcessing(true);
      log('INFO', 'Job Repeated', { sourceId });
  };

  // --- Retry Handlers ---

  const handleRetry = (item: FailedItem) => {
      // Check limits before retrying
      const isSafety = item.error.toLowerCase().includes('prohibited') || item.error.toLowerCase().includes('safety');
      const limit = isSafety ? options.safetyRetryLimit : options.retryLimit;

      if (item.retryCount >= limit) return;
      
      setFailedItems(prev => prev.filter(f => f.id !== item.id));
      
      if (item.originalJob) {
          const retryJob: Job = { ...(item.originalJob as Job), retryCount: item.retryCount + 1, status: 'QUEUED' };
          // Append to end of queue (bottom)
          setJobQueue(prev => [...prev, retryJob]);
          if (!isProcessing) setIsProcessing(true);
      }
  };

  const handleRetryAll = (itemsToRetry: FailedItem[]) => {
      const itemIdsToRemove = new Set<string>();
      const jobsToAdd: Job[] = [];

      itemsToRetry.forEach(item => {
          const isSafety = item.error.toLowerCase().includes('prohibited') || item.error.toLowerCase().includes('safety');
          const limit = isSafety ? options.safetyRetryLimit : options.retryLimit;
          
          if (item.retryCount < limit && item.originalJob) {
              itemIdsToRemove.add(item.id);
              const retryJob: Job = { 
                  ...(item.originalJob as Job), 
                  retryCount: item.retryCount + 1, 
                  status: 'QUEUED' 
              };
              jobsToAdd.push(retryJob);
          }
      });
      
      if (jobsToAdd.length > 0) {
          setFailedItems(prev => prev.filter(f => !itemIdsToRemove.has(f.id)));
          setJobQueue(prev => [...prev, ...jobsToAdd]); // Append to bottom
          if (!isProcessing) setIsProcessing(true);
          log('INFO', 'Batch Retry Started', { count: jobsToAdd.length });
      }
  };

  const handleDeleteFailed = (id: string) => {
      setFailedItems(prev => prev.filter(f => f.id !== id));
  };
  
  const handleDeleteAllBlocked = (items: FailedItem[]) => {
      const idsToDelete = new Set(items.map(i => i.id));
      setFailedItems(prev => prev.filter(f => !idsToDelete.has(f.id)));
  };
  
  const handleDeleteGalleryItem = (id: string) => {
      setGeneratedImages(prev => prev.filter(img => img.id !== id));
  };

  const handleClearGallery = () => {
      if (generatedImages.length === 0)
          return;
      setGeneratedImages([]);
  };

  const handleToggleSourceFilter = (id: string) => {
      setSelectedSourceIds(prev => {
          // Single select behavior: Unselect if clicked again, otherwise select ONLY this one
          if (prev.has(id)) return new Set();
          return new Set([id]);
      });
  };

  const handleDeleteSource = (id: string) => {
      // Auto-download log if exists before deletion
      const source = sourceRegistry.get(id);
      if (source && source.activityLog && source.activityLog.length > 0) {
          const logData = {
              sourceImage: source.originalUploadName || source.name,
              processedAt: new Date().toISOString(),
              jobHistory: source.activityLog
          };
          
          const filename = `${(source.originalUploadName || source.name).split('.')[0]}.kca`;
          const blob = new Blob([JSON.stringify(logData, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          log('INFO', 'Activity log downloaded', { filename });
      }

      // Cleanup Object URL for memory
      if (source && source.previewUrl) {
          URL.revokeObjectURL(source.previewUrl);
      }

      // Remove source
      setSourceRegistry(prev => {
          const next = new Map(prev);
          next.delete(id);
          return next;
      });
      // Remove all related active jobs
      setJobQueue(prev => prev.filter(j => j.sourceImageId !== id));
      // Remove from validation queue
      setValidationQueue(prev => prev.filter(j => j.sourceImageId !== id));
      // Remove from failed/blocked lists
      setFailedItems(prev => prev.filter(f => f.sourceImageId !== id));
      // Remove from generated gallery
      setGeneratedImages(prev => prev.filter(g => g.sourceImageId !== id));
      // Remove related filters
      setSelectedSourceIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
      });
  };

  // --- Queue Emptying Logic ---
  const handleRemoveFinishedUploads = () => {
      // Finished means: No active jobs AND No pending validation AND No Failed jobs (that can be retried)
      const activeSourceIds = new Set<string>();
      
      jobQueue.forEach(j => activeSourceIds.add(j.sourceImageId));
      validationQueue.forEach(v => activeSourceIds.add(v.sourceImageId));
      
      // Also check failed items (if retriable)
      failedItems.forEach(f => {
          const isSafety = f.error.toLowerCase().includes('prohibited') || f.error.toLowerCase().includes('safety');
          const limit = isSafety ? options.safetyRetryLimit : options.retryLimit;
          if (f.retryCount < limit) {
             activeSourceIds.add(f.sourceImageId);
          }
      });

      const finishedSources: string[] = [];
      sourceRegistry.forEach((src, id) => {
          if (!activeSourceIds.has(id)) {
              finishedSources.push(id);
          }
      });

      // Using the delete logic for cleanup
      finishedSources.forEach(id => handleDeleteSource(id));
      log('INFO', 'Removed finished uploads', { count: finishedSources.length });
  };

  const handleEmptyValidationQueue = () => {
      setValidationQueue([]);
  };

  const handleEmptyJobQueue = () => {
      // Only remove QUEUED jobs, keep PROCESSING
      setJobQueue(prev => prev.filter(j => j.status === 'PROCESSING'));
  };

  const handleEmptyFailed = (items: FailedItem[]) => {
      const idsToRemove = new Set(items.map(i => i.id));
      setFailedItems(prev => prev.filter(f => !idsToRemove.has(f.id)));
  };

  // Retry logic for specific source
  const handleRetrySource = (id: string) => {
    const sourceFailures = failedItems.filter(f => f.sourceImageId === id);
    if (sourceFailures.length > 0) {
        handleRetryAll(sourceFailures);
    }
  };

  // --- Status Derivation ---
  let currentStatusTitle = 'SYSTEM IDLE';
  let currentStatusDetail = 'Ready to process queue.';

  if (isRestoring) {
      currentStatusTitle = 'RESTORING';
      currentStatusDetail = 'Loading previous session...';
  } else if (isValidating) {
      currentStatusTitle = 'VALIDATING';
      currentStatusDetail = `Analyzing upload ${validationQueue.length}...`;
  } else if (isProcessing) {
    if (processingCount > 0) {
        currentStatusTitle = `GENERATING (${processingCount}/${options.concurrentJobs})`;
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

  const scrollToTop = () => {
    galleryScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    galleryScrollRef.current?.scrollTo({ top: galleryScrollRef.current.scrollHeight, behavior: 'smooth' });
  };

  // --- Filtering & Sorting Logic for Main Gallery ---
  const displayItems = useMemo(() => {
    // We combine Generated Images AND active Processing Jobs into one view
    // Processing Jobs act as placeholders
    
    const processingItems = processingJobs.map(job => {
        // Find source image for preview
        const src = sourceRegistry.get(job.sourceImageId);
        return {
            type: 'JOB',
            id: job.id,
            url: src?.previewUrl || '', // Show original as placeholder
            originalFilename: job.originalFilename,
            timestamp: Date.now(), // Sort to top/bottom depending on sort
            sourceImageId: job.sourceImageId,
            optionsUsed: job.optionsSummary,
            isProcessing: true
        };
    });

    const generatedItems = generatedImages.map(img => ({
        type: 'GENERATED',
        ...img,
        isProcessing: false
    }));

    let baseList = [...processingItems, ...generatedItems];

    // Sort by criteria first
    baseList.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
            case 'FILENAME':
                comparison = a.originalFilename.localeCompare(b.originalFilename);
                break;
            case 'QUEUE':
                // Sort by Source Image Name (Grouping)
                const sourceA = sourceRegistry.get(a.sourceImageId);
                const sourceB = sourceRegistry.get(b.sourceImageId);
                const nameA = sourceA?.name || "";
                const nameB = sourceB?.name || "";
                comparison = nameA.localeCompare(nameB);
                break;
            case 'TIMESTAMP':
            default:
                comparison = a.timestamp - b.timestamp;
                break;
        }
        return sortOrder === 'ASC' ? comparison : -comparison;
    });

    // If selection is active, prioritize selected source items to the TOP
    if (selectedSourceIds.size > 0) {
        const selected = baseList.filter(img => selectedSourceIds.has(img.sourceImageId));
        const others = baseList.filter(img => !selectedSourceIds.has(img.sourceImageId));
        return [...selected, ...others];
    }

    return baseList;
  }, [generatedImages, processingJobs, selectedSourceIds, sortBy, sortOrder, sourceRegistry]);

  // Thumbnail sizing style
  const getThumbnailStyle = () => {
      // Relative to gallery container (80vw)
      switch (thumbnailSize) {
          case 'MEDIUM':
              return { width: '32%', maxHeight: 'auto' };
          case 'LARGE':
              return { width: '48%', maxHeight: 'auto' };
          case 'SMALL':
          default:
              return { width: '19%', maxHeight: 'auto' };
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
          <div className="absolute inset-0 z-50 bg-violet-900/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none animate-in fade-in duration-200">
             <div className="p-8 bg-black/50 rounded-2xl border-4 border-dashed border-violet-500 flex flex-col items-center">
                <Upload size={64} className="text-violet-400 mb-4 animate-bounce" />
                <h2 className="text-3xl font-bold text-white mb-2">Drop Images Here</h2>
                <p className="text-violet-200">Add to Processing Queue</p>
             </div>
          </div>
      )}
      
      {/* Header */}
      <header className="relative h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 z-20 shadow-xl">
        <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center shadow-lg shadow-violet-900/50">
                <span className="text-white font-black text-xl">C</span>
            </div>
            <div>
                <h1 className="font-bold text-lg tracking-tight">ChromaForge</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest">Katje B.V.</p>
            </div>
        </div>

        {/* Detailed Stats Container - Responsive */}
        <div className="hidden lg:flex flex-1 mx-8 bg-slate-800/50 border border-slate-700/50 rounded-lg p-1.5 items-center justify-around text-xs font-mono group">
            
            {/* Simple Progress Bar Section */}
            <div className="flex items-center gap-4 flex-1 px-4">
                <div className="flex flex-col flex-1 gap-1">
                    <div className="flex justify-between items-end">
                        <span className="text-[10px] text-slate-400 font-bold tracking-wider">BATCH PROGRESS</span>
                        <span className="text-[10px] text-violet-400 font-bold">{totalProcessed} / {totalVariationsScheduled} JOBS</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-violet-500 transition-all duration-300"
                            style={{ width: `${progressPercentage}%` }}
                        />
                    </div>
                </div>
            </div>

            <div className="w-px h-6 bg-slate-700 z-10" />
            
            {/* Status Section */}
            <div className="flex flex-col px-4 min-w-[200px] z-10">
                 <div className="flex items-center gap-2 mb-0.5">
                     {isProcessing || isRestoring || isValidating ? (
                         <Loader2 size={12} className="animate-spin text-amber-500" />
                     ) : (
                         <Activity size={12} className="text-slate-600" />
                     )}
                     <span className={`text-[10px] font-bold uppercase tracking-wider ${isProcessing || isRestoring || isValidating ? 'text-amber-500' : 'text-slate-500'}`}>
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
                   ? 'bg-slate-800 border-violet-900 text-violet-400 hover:bg-slate-700' 
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
                   : 'bg-violet-600 hover:bg-violet-500 text-white hover:shadow-violet-500/20'
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

      {/* Button Bar (Global Toolbar) */}
      <div className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 z-10 shadow-md overflow-x-auto">
           {/* Left: Sidebar Tabs */}
           <div className="flex items-center gap-1">
               {sidebarTabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveSidebarTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all border ${
                            activeSidebarTab === tab.id 
                            ? 'bg-slate-800 border-slate-600 text-white shadow-sm' 
                            : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                        }`}
                    >
                        <tab.icon size={16} className={activeSidebarTab === tab.id ? tab.color : ''} />
                        <span className="text-xs font-bold uppercase tracking-wider">{tab.label}</span>
                        {tab.count > 0 && (
                            <span className={`text-[10px] px-1.5 rounded-full font-bold ${activeSidebarTab === tab.id ? 'bg-slate-900 text-slate-300' : 'bg-slate-800 text-slate-500'}`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
               ))}
           </div>

           {/* Right: Gallery Controls */}
           <div className="flex items-center gap-4 ml-8">
               
               {/* Thumbnail Size Selector */}
               <div className="flex items-center bg-slate-800 rounded p-1 border border-slate-700">
                   <span className="px-2 text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1"><Grip size={12}/> Size:</span>
                   <button onClick={() => setThumbnailSize('SMALL')} className={`p-1.5 rounded text-xs font-bold w-8 ${thumbnailSize === 'SMALL' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>S</button>
                   <button onClick={() => setThumbnailSize('MEDIUM')} className={`p-1.5 rounded text-xs font-bold w-8 ${thumbnailSize === 'MEDIUM' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>M</button>
                   <button onClick={() => setThumbnailSize('LARGE')} className={`p-1.5 rounded text-xs font-bold w-8 ${thumbnailSize === 'LARGE' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}>L</button>
               </div>

               {/* Sort Controls */}
               <div className="flex items-center bg-slate-800 rounded p-1 border border-slate-700">
                    <span className="px-2 text-[10px] uppercase font-bold text-slate-500">Sort:</span>
                    
                    <div className="flex items-center gap-0.5 mr-2">
                        <button 
                            onClick={() => setSortBy('QUEUE')}
                            className={`p-1.5 rounded flex items-center gap-1 transition-colors text-xs font-medium ${sortBy === 'QUEUE' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                            title="Sort by Queue (Source)"
                        >
                            <LayoutList size={14} /> <span className="hidden sm:inline">Queue</span>
                        </button>
                        <button 
                            onClick={() => setSortBy('FILENAME')}
                            className={`p-1.5 rounded flex items-center gap-1 transition-colors text-xs font-medium ${sortBy === 'FILENAME' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                            title="Sort by File Name"
                        >
                            <Type size={14} /> <span className="hidden sm:inline">Name</span>
                        </button>
                        <button 
                            onClick={() => setSortBy('TIMESTAMP')}
                            className={`p-1.5 rounded flex items-center gap-1 transition-colors text-xs font-medium ${sortBy === 'TIMESTAMP' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                            title="Sort by Time"
                        >
                            <Calendar size={14} /> <span className="hidden sm:inline">Time</span>
                        </button>
                    </div>

                    <div className="w-px h-4 bg-slate-700 mx-1"/>

                    <button 
                        onClick={() => setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                        title={sortOrder === 'ASC' ? "Ascending" : "Descending"}
                    >
                        {sortOrder === 'ASC' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                    </button>
               </div>

               {generatedImages.length > 0 && (
                   <button 
                    onClick={handleClearGallery} 
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 border border-transparent hover:border-red-900/50 rounded-lg transition-all ml-2 text-xs font-bold uppercase tracking-wider"
                    type="button"
                   >
                       <Trash2 size={14} /> Delete All
                   </button>
               )}
           </div>
      </div>

      {/* Main Layout */}
      <main className="flex-1 flex overflow-hidden relative" onMouseMove={(e) => { if(isResizingSidebar) e.preventDefault(); }}>
        
        {/* Left Sidebar: Dynamic Width */}
        <div 
            className="shrink-0 h-full border-r border-slate-800 bg-slate-950" 
            style={{ 
                width: `${sidebarWidth}vw`, 
                transition: isResizingSidebar ? 'none' : 'width 75ms ease-out' 
            }}
        >
            <Sidebar 
              activeTab={activeSidebarTab}
              jobs={jobQueue}
              validationQueue={validationQueue}
              sourceRegistry={sourceRegistry}
              failedItems={failedItems}
              selectedSourceIds={selectedSourceIds}
              generatedImages={generatedImages}
              onToggleSource={handleToggleSourceFilter}
              onDeselectAll={() => setSelectedSourceIds(new Set())}
              onRetry={handleRetry}
              onRetryAll={handleRetryAll}
              onRetrySource={handleRetrySource}
              onDeleteFailed={handleDeleteFailed}
              onDeleteJob={handleRemoveJob}
              onDeleteSource={handleDeleteSource}
              onDeleteAllBlocked={handleDeleteAllBlocked}
              onViewJob={setViewedJob}
              onRemoveFinishedUploads={handleRemoveFinishedUploads}
              onEmptyValidation={handleEmptyValidationQueue}
              onEmptyJobQueue={handleEmptyJobQueue}
              onEmptyFailed={handleEmptyFailed}
              onPrioritizeSource={handlePrioritizeSource}
              retryLimit={options.retryLimit}
              safetyRetryLimit={options.safetyRetryLimit}
              sidebarWidth={sidebarWidth}
              setSidebarWidth={setSidebarWidth}
            />
        </div>

        {/* DRAG HANDLE */}
        <div
            className={`absolute top-0 bottom-0 w-1.5 -ml-[3px] cursor-col-resize z-50 transition-colors ${isResizingSidebar ? 'bg-violet-600' : 'hover:bg-violet-500/50'}`}
            style={{ left: `${sidebarWidth}vw` }}
            onMouseDown={startResizing}
        />

        {/* Right Gallery: Dynamic Width */}
        <div 
            className="bg-slate-950 flex flex-col min-w-0 h-full relative" 
            style={{ 
                width: `${100 - sidebarWidth}vw`,
                transition: isResizingSidebar ? 'none' : 'width 75ms ease-out' 
            }}
        >
           {/* Info Bar with Sort Controls (Cleaned Up) */}
           <div className="h-10 border-b border-slate-800 bg-slate-900 flex items-center px-4 justify-between text-xs text-slate-500 shrink-0 z-10">
               <div className="flex items-center gap-2">
                   <span className="font-bold text-slate-400">
                      Results: {displayItems.length} 
                   </span>
                   {selectedSourceIds.size > 0 && (
                       <span className="bg-violet-900/30 text-violet-400 px-2 py-0.5 rounded border border-violet-900/50">
                           Prioritizing Selected Source ({selectedSourceIds.size})
                       </span>
                   )}
               </div>
           </div>
           
           {/* Grid */}
           <div ref={galleryScrollRef} className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-950 relative scroll-smooth">
                {displayItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-700">
                        <div className="w-24 h-24 rounded-full border-4 border-slate-800 flex items-center justify-center mb-4">
                            {selectedSourceIds.size > 0 ? (
                                <Search size={48} className="opacity-20" />
                            ) : (
                                <Plus size={48} className="opacity-20" />
                            )}
                        </div>
                        <p>{selectedSourceIds.size > 0 ? "No images found for selected filters." : "Generated artworks will appear here."}</p>
                        {selectedSourceIds.size === 0 && <p className="text-xs mt-2 text-slate-600">Drag images anywhere to add them.</p>}
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-4 pb-20 justify-start align-top content-start">
                        {displayItems.map((item: any) => {
                            const isSelected = selectedSourceIds.has(item.sourceImageId);
                            return (
                                <div 
                                    key={item.id} 
                                    className={`group relative bg-slate-900 rounded-lg overflow-hidden shadow-md transition-all flex items-center justify-center ${isSelected ? 'border-4 border-violet-500' : 'border border-slate-800'}`}
                                    style={{ flexGrow: 0, ...getThumbnailStyle() }}
                                >
                                    <div className="relative w-full h-full">
                                        <img 
                                            src={item.url} 
                                            alt="content" 
                                            className={`w-full h-auto object-contain ${item.isProcessing ? 'opacity-50 blur-[2px]' : 'cursor-zoom-in'}`}
                                            loading="lazy"
                                            onClick={() => !item.isProcessing && setViewedImage(item)}
                                        />

                                        {/* Processing Overlay */}
                                        {item.isProcessing && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                                <Loader2 className="animate-spin text-amber-500 w-12 h-12" />
                                            </div>
                                        )}
                                        
                                        {/* Actions (Only for finished items) */}
                                        {!item.isProcessing && (
                                            <>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleRepeatJob(item); }}
                                                    className="absolute top-2 left-2 p-2 bg-black/60 hover:bg-violet-600 text-white rounded opacity-0 group-hover:opacity-100 transition-all z-20 pointer-events-auto shadow-lg"
                                                    title="Repeat this specific job configuration"
                                                >
                                                    <RefreshCw size={16} />
                                                </button>

                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteGalleryItem(item.id); }}
                                                    className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-all z-20 pointer-events-auto shadow-lg"
                                                    title="Delete Result"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </>
                                        )}

                                        {/* Overlay Details */}
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-4 pt-12 flex flex-col justify-end pointer-events-none transition-opacity opacity-0 group-hover:opacity-100">
                                            <p className="text-sm text-white font-bold mb-1 truncate">{item.originalFilename}</p>
                                            <div className="flex flex-wrap gap-1 mb-2 max-h-12 overflow-hidden">
                                                {item.optionsUsed.split(', ').map((opt: string, i: number) => (
                                                    <span key={i} className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-slate-300 border border-white/5">
                                                        {opt}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
           </div>

           {/* Floating Scroll Buttons */}
           <div className="absolute bottom-6 right-8 flex flex-col gap-2 z-30">
               <button 
                  onClick={scrollToTop} 
                  className="p-3 bg-slate-800/80 hover:bg-violet-600 text-white rounded-full shadow-lg border border-slate-700 backdrop-blur transition-all"
                  title="Scroll to Top"
               >
                   <ArrowUp size={24} />
               </button>
               <button 
                  onClick={scrollToBottom} 
                  className="p-3 bg-slate-800/80 hover:bg-violet-600 text-white rounded-full shadow-lg border border-slate-700 backdrop-blur transition-all"
                  title="Scroll to Bottom"
               >
                   <ArrowDown size={24} />
               </button>
           </div>
        </div>
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
        sourceUrl={viewedImage && 'sourceImageId' in viewedImage ? sourceRegistry.get(viewedImage.sourceImageId)?.previewUrl : undefined}
        onClose={() => setViewedImage(null)}
        onNext={handleNextImage}
        onPrev={handlePrevImage}
        onRepeat={handleRepeatJob}
        onDelete={(img) => handleDeleteGalleryItem(img.id)}
        hasNext={viewedImage && 'id' in viewedImage ? generatedImages.findIndex(i => i.id === viewedImage.id) < generatedImages.length - 1 : false}
        hasPrev={viewedImage && 'id' in viewedImage ? generatedImages.findIndex(i => i.id === viewedImage.id) > 0 : false}
      />

      <JobDetailDialog 
         job={viewedJob}
         onClose={() => setViewedJob(null)}
      />

    </div>
  );
};

export default App;