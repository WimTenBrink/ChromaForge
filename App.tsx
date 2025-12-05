import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, Settings, Terminal, Shield, ShieldCheck, Trash2, Loader2, Activity, Book, Upload, Save, FolderOpen, Plus, Search, RefreshCw, ArrowUpCircle, ArrowDownCircle, ArrowUp, ArrowDown, Calendar, Type, LayoutList, Grip, Monitor } from 'lucide-react';
import Sidebar from './components/Sidebar';
import OptionsDialog from './components/OptionsDialog';
import ConsoleDialog from './components/ConsoleDialog';
import ImageDetailDialog from './components/ImageDetailDialog';
import ManualDialog from './components/ManualDialog';
import JobDetailDialog from './components/JobDetailDialog';
import { AppOptions, Job, GeneratedImage, FailedItem, ImageAnalysis, GlobalConfig, SourceImage, ValidationJob } from './types';
import { DEFAULT_OPTIONS } from './constants';
import { generatePermutations, buildPromptFromCombo } from './utils/combinatorics';
import { processImage, validateFileName } from './services/geminiService';
import { log } from './services/logger';
import { saveState, loadState } from './services/db';

const App: React.FC = () => {
  // --- State ---
  const [options, setOptions] = useState<AppOptions>(DEFAULT_OPTIONS);
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null);
  const [maxConcurrentJobs, setMaxConcurrentJobs] = useState(5);
  
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
  
  // View Viewer (Zoom)
  const [viewedImage, setViewedImage] = useState<GeneratedImage | { url: string, title: string, metadata: string } | null>(null);
  const [viewedJob, setViewedJob] = useState<Job | FailedItem | null>(null);
  
  const [apiKeyReady, setApiKeyReady] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);

  // File Input Ref for Import
  const queueFileInputRef = useRef<HTMLInputElement>(null);
  const galleryScrollRef = useRef<HTMLDivElement>(null);

  // Statistics & Timing
  const [jobDurations, setJobDurations] = useState<number[]>([]);

  // Derived Statistics
  const activeJobs = jobQueue.filter(j => j.status === 'QUEUED' || j.status === 'PROCESSING');
  const processingCount = jobQueue.filter(j => j.status === 'PROCESSING').length;
  
  const totalVariationsScheduled = jobQueue.length + generatedImages.length + failedItems.length;
  const totalProcessed = generatedImages.length + failedItems.length;
  const progressPercentage = totalVariationsScheduled === 0 ? 0 : Math.round((totalProcessed / totalVariationsScheduled) * 100);

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
          setSourceRegistry(prev => {
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

  // --- Queue Import/Export ---

  const handleExportQueue = () => {
      if (jobQueue.length === 0) {
          alert("Queue is empty.");
          return;
      }

      // Serialize Registry (Exclude File objects, they aren't serializable, rely on base64)
      const registryArray = Array.from(sourceRegistry.entries()).map(([id, src]) => {
          return [id, {
              ...(src as any),
              file: null, // Drop the file object
              previewUrl: '' // Drop the blob URL (will regenerate on import)
          }];
      });

      const data = {
          version: '2.0',
          timestamp: Date.now(),
          queue: jobQueue,
          registry: registryArray
      };

      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chromaforge_queue_${new Date().toISOString().slice(0, 10)}.klj`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      log('INFO', 'Queue exported', { count: jobQueue.length });
  };

  const handleImportQueue = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const content = event.target?.result as string;
              const data = JSON.parse(content);

              if (!data.queue || !Array.isArray(data.queue) || !data.registry) {
                  throw new Error("Invalid .klj file format.");
              }

              const newRegistry = new Map(sourceRegistry);
              let restoredCount = 0;

              // 1. Restore Registry
              for (const [id, src] of data.registry) {
                  // Only add if not present to avoid overwriting active blob URLs if they exist
                  if (!newRegistry.has(id)) {
                      // Regenerate Blob URL from Base64
                      const res = await fetch(`data:${src.type};base64,${src.base64Data}`);
                      const blob = await res.blob();
                      const previewUrl = URL.createObjectURL(blob);
                      
                      newRegistry.set(id, {
                          ...(src as any),
                          file: null,
                          previewUrl
                      });
                      restoredCount++;
                  }
              }

              // 2. Restore Jobs (Filter duplicates)
              const existingJobIds = new Set(jobQueue.map(j => j.id));
              const newJobs = data.queue.filter((j: Job) => !existingJobIds.has(j.id));

              setSourceRegistry(newRegistry);
              setJobQueue(prev => [...prev, ...newJobs]);

              log('INFO', 'Queue imported', { importedJobs: newJobs.length, restoredSources: restoredCount });
              alert(`Queue imported: ${newJobs.length} jobs added.`);

          } catch (err) {
              console.error(err);
              log('ERROR', 'Import failed', err);
              alert("Failed to import queue file. The file might be corrupted or incompatible.");
          }
          // Reset input
          if (queueFileInputRef.current) queueFileInputRef.current.value = '';
      };
      reader.readAsText(file);
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
    const currentSources = Array.from(sourceRegistry.values());
    
    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        
        // Check for duplicates by filename
        const duplicate = currentSources.find((s: SourceImage) => s.originalUploadName === file.name);
        if (duplicate) {
            log('WARN', 'Skipping duplicate upload', { fileName: file.name });
            continue;
        }

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
            status: 'VALIDATING'
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
    } else {
        if (fileList.length > 0) {
           alert("No new files added. Duplicates were skipped.");
        }
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
             const permutations = generatePermutations(job.optionsSnapshot);
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

                newJobs.push({
                    id: crypto.randomUUID(),
                    sourceImageId: job.sourceImageId,
                    originalFilename: displayFilename,
                    generatedTitle: "Pending...",
                    prompt: buildPromptFromCombo(combo),
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
  }, [validationQueue, isValidating, apiKeyReady]);


  const handleRemoveJob = (id: string) => {
    setJobQueue(prev => prev.filter(j => j.id !== id));
  };

  const autoDownloadImage = (imageUrl: string, originalFilename: string, optionsSummary: string) => {
      // Use originalFilename which has already been generated (e.g., 'elf-warrior_001')
      const filename = `${originalFilename}.png`;
      
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
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
    if (activeWorkers >= maxConcurrentJobs) return;
    
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

  }, [isProcessing, jobQueue, maxConcurrentJobs]); // Dependency on jobQueue ensures re-run when status changes

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
            timestamp: Date.now(),
            optionsSnapshot: job.optionsSnapshot
        };

        setGeneratedImages(prev => [generated, ...prev]);
        autoDownloadImage(imageUrl, job.originalFilename, job.optionsSummary);
        
        // Remove from Queue upon completion (it moves to Gallery)
        setJobQueue(prev => prev.filter(j => j.id !== job.id));

    } catch (error: any) {
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
        setJobQueue(prev => prev.filter(j => j.id !== job.id));
    }
  };

  // --- Repeat Job Logic ---
  const handleRepeatJob = (img: GeneratedImage) => {
      // Reconstruct job from GeneratedImage info
      const sourceId = img.sourceImageId;
      const options = img.optionsSnapshot;

      if (!sourceId || !options) {
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
        aspectRatio: undefined, // Could be extracted from options if needed
        optionsSnapshot: options,
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
      const limit = isSafety ? 1 : 3;

      if (item.retryCount >= limit) return;
      
      setFailedItems(prev => prev.filter(f => f.id !== item.id));
      
      if (item.originalJob) {
          const retryJob: Job = { ...(item.originalJob as Job), retryCount: item.retryCount + 1, status: 'QUEUED' };
          // Add to top of queue for priority? Or end?
          // Usually retries get priority, but user asked repeated jobs to go to end.
          // Let's stick to adding retries to top for now as per previous logic, unless specified.
          setJobQueue(prev => [retryJob, ...prev]);
          if (!isProcessing) setIsProcessing(true);
      }
  };

  const handleRetryAll = (itemsToRetry: FailedItem[]) => {
      const itemIdsToRemove = new Set<string>();
      const jobsToAdd: Job[] = [];

      itemsToRetry.forEach(item => {
          const isSafety = item.error.toLowerCase().includes('prohibited') || item.error.toLowerCase().includes('safety');
          const limit = isSafety ? 1 : 3;
          
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
          setJobQueue(prev => [...jobsToAdd, ...prev]); // Add to top
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
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
      });
  };

  const handleDeleteSource = (id: string) => {
      // Cleanup Object URL for memory
      const source = sourceRegistry.get(id);
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
      // Finished means: No active jobs AND No pending validation AND No Failed jobs
      const activeSourceIds = new Set<string>();
      
      jobQueue.forEach(j => activeSourceIds.add(j.sourceImageId));
      validationQueue.forEach(v => activeSourceIds.add(v.sourceImageId));
      
      // Also check failed items
      failedItems.forEach(f => {
          if (f.retryCount < 3 && !f.error.toLowerCase().includes('blocked')) {
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
        currentStatusTitle = `GENERATING (${processingCount}/${maxConcurrentJobs})`;
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
  const displayImages = useMemo(() => {
    // 1. Filter
    let filtered = selectedSourceIds.size > 0 
      ? generatedImages.filter(img => selectedSourceIds.has(img.sourceImageId))
      : [...generatedImages];

    // 2. Sort
    filtered.sort((a, b) => {
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

    return filtered;
  }, [generatedImages, selectedSourceIds, sortBy, sortOrder, sourceRegistry]);

  // Thumbnail sizing style
  const getThumbnailStyle = () => {
      // Relative to gallery container (80vw)
      // Small: ~20%, Medium: ~35%, Large: ~50%
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
      {/* Hidden File Input for Queue Import */}
      <input 
          type="file" 
          ref={queueFileInputRef} 
          accept=".klj,.clj" 
          className="hidden" 
          onChange={handleImportQueue}
      />

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
      <header className="relative h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0 z-20 shadow-xl">
        <div className="flex items-center gap-4">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-900/50">
                <span className="text-black font-black text-xl">C</span>
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
                        <span className="text-[10px] text-emerald-400 font-bold">{totalProcessed} / {totalVariationsScheduled} JOBS</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-emerald-500 transition-all duration-300"
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
             {/* Queue Import/Export */}
             <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700 gap-1">
                <button
                    onClick={handleExportQueue}
                    disabled={jobQueue.length === 0}
                    className={`p-1.5 rounded-md transition-colors ${
                        jobQueue.length === 0 
                        ? 'text-slate-600 cursor-not-allowed' 
                        : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-700'
                    }`}
                    title="Export Queue to .klj"
                >
                    <Save size={18} />
                </button>
                <div className="w-px h-4 bg-slate-700"></div>
                <button
                    onClick={() => queueFileInputRef.current?.click()}
                    className="p-1.5 rounded-md text-slate-400 hover:text-emerald-400 hover:bg-slate-700 transition-colors"
                    title="Import Queue from .klj"
                >
                    <FolderOpen size={18} />
                </button>
             </div>

             {/* Job Count Input */}
             <div className="flex items-center bg-slate-800 rounded-lg p-1 border border-slate-700 h-9" title="Concurrent Job Limit">
                 <span className="text-[10px] text-slate-500 font-bold px-2 uppercase hidden xl:inline">Jobs:</span>
                 <input 
                    type="number" 
                    min={1} 
                    max={12} 
                    value={maxConcurrentJobs}
                    onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) setMaxConcurrentJobs(Math.max(1, Math.min(12, val)));
                    }}
                    className="w-10 bg-slate-900 border border-slate-600 rounded text-xs text-center text-white focus:border-emerald-500 outline-none py-0.5"
                 />
             </div>

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
        
        {/* Left Sidebar: 20vw */}
        <div className="w-[20vw] shrink-0 h-full border-r border-slate-800 bg-slate-950">
            <Sidebar 
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
              onDeleteFailed={handleDeleteFailed}
              onDeleteJob={handleRemoveJob}
              onDeleteSource={handleDeleteSource}
              onDeleteAllBlocked={handleDeleteAllBlocked}
              onViewJob={setViewedJob}
              onRemoveFinishedUploads={handleRemoveFinishedUploads}
              onEmptyValidation={handleEmptyValidationQueue}
              onEmptyJobQueue={handleEmptyJobQueue}
              onEmptyFailed={handleEmptyFailed}
            />
        </div>

        {/* Right Gallery: 80vw */}
        <div className="w-[80vw] bg-slate-950 flex flex-col min-w-0 h-full relative">
           {/* Info Bar with Sort Controls */}
           <div className="h-12 border-b border-slate-800 bg-slate-900 flex items-center px-4 justify-between text-xs text-slate-500 shrink-0 z-10">
               
               {/* Left: Counts */}
               <div className="flex items-center gap-2">
                   <span className="font-bold text-slate-400">
                      Results: {displayImages.length} 
                   </span>
                   {selectedSourceIds.size > 0 && (
                       <span className="bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded border border-emerald-900/50">
                           Filtered by Source
                       </span>
                   )}
               </div>

               {/* Right: Controls */}
               <div className="flex items-center gap-4">
                   {/* Thumbnail Size Selector */}
                   <div className="flex items-center bg-slate-800 rounded p-1 border border-slate-700">
                       <span className="px-2 text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1"><Grip size={12}/> Size:</span>
                       <button onClick={() => setThumbnailSize('SMALL')} className={`p-1 rounded ${thumbnailSize === 'SMALL' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>S</button>
                       <button onClick={() => setThumbnailSize('MEDIUM')} className={`p-1 rounded ${thumbnailSize === 'MEDIUM' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>M</button>
                       <button onClick={() => setThumbnailSize('LARGE')} className={`p-1 rounded ${thumbnailSize === 'LARGE' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>L</button>
                   </div>

                   {/* Sort Controls */}
                   <div className="flex items-center bg-slate-800 rounded p-1 border border-slate-700">
                        <span className="px-2 text-[10px] uppercase font-bold text-slate-500">Sort:</span>
                        
                        <div className="flex items-center gap-0.5 mr-2">
                            <button 
                                onClick={() => setSortBy('QUEUE')}
                                className={`p-1.5 rounded flex items-center gap-1 transition-colors ${sortBy === 'QUEUE' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                title="Sort by Queue (Source)"
                            >
                                <LayoutList size={14} /> <span className="hidden sm:inline">Queue</span>
                            </button>
                            <button 
                                onClick={() => setSortBy('FILENAME')}
                                className={`p-1.5 rounded flex items-center gap-1 transition-colors ${sortBy === 'FILENAME' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                                title="Sort by File Name"
                            >
                                <Type size={14} /> <span className="hidden sm:inline">Name</span>
                            </button>
                            <button 
                                onClick={() => setSortBy('TIMESTAMP')}
                                className={`p-1.5 rounded flex items-center gap-1 transition-colors ${sortBy === 'TIMESTAMP' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}
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
                        className="flex items-center gap-2 px-3 py-1 bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 border border-transparent hover:border-red-900/50 rounded transition-all ml-2"
                        type="button"
                       >
                           <Trash2 size={12} /> Delete All
                       </button>
                   )}
               </div>
           </div>
           
           {/* Grid */}
           <div ref={galleryScrollRef} className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-950 relative scroll-smooth">
                {displayImages.length === 0 ? (
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
                        {displayImages.map(img => (
                            <div 
                                key={img.id} 
                                className="group relative bg-slate-900 rounded-lg overflow-hidden border border-slate-800 shadow-md hover:shadow-emerald-500/10 transition-all flex items-center justify-center"
                                style={{ flexGrow: 0, ...getThumbnailStyle() }}
                            >
                                <div className="relative w-full h-full">
                                    <img 
                                        src={img.url} 
                                        alt="generated" 
                                        className="w-full h-auto object-contain cursor-zoom-in"
                                        loading="lazy"
                                        onClick={() => setViewedImage(img)}
                                    />
                                    
                                    {/* Repeat Button (Always visible on hover) */}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRepeatJob(img); }}
                                        className="absolute top-2 left-2 p-2 bg-black/60 hover:bg-emerald-600 text-white rounded opacity-0 group-hover:opacity-100 transition-all z-20 pointer-events-auto shadow-lg"
                                        title="Repeat this specific job configuration"
                                    >
                                        <RefreshCw size={16} />
                                    </button>

                                    {/* Delete Button */}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleDeleteGalleryItem(img.id); }}
                                        className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-red-500 text-white rounded opacity-0 group-hover:opacity-100 transition-all z-20 pointer-events-auto shadow-lg"
                                        title="Delete Result"
                                    >
                                        <Trash2 size={16} />
                                    </button>

                                    {/* Overlay Details */}
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-4 pt-12 flex flex-col justify-end pointer-events-none transition-opacity opacity-0 group-hover:opacity-100">
                                        <p className="text-sm text-white font-bold mb-1 truncate">{img.originalFilename}</p>
                                        <div className="flex flex-wrap gap-1 mb-2 max-h-12 overflow-hidden">
                                            {img.optionsUsed.split(', ').map((opt, i) => (
                                                <span key={i} className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-slate-300 border border-white/5">
                                                    {opt}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
           </div>

           {/* Floating Scroll Buttons */}
           <div className="absolute bottom-6 right-8 flex flex-col gap-2 z-30">
               <button 
                  onClick={scrollToTop} 
                  className="p-3 bg-slate-800/80 hover:bg-emerald-600 text-white rounded-full shadow-lg border border-slate-700 backdrop-blur transition-all"
                  title="Scroll to Top"
               >
                   <ArrowUpCircle size={24} />
               </button>
               <button 
                  onClick={scrollToBottom} 
                  className="p-3 bg-slate-800/80 hover:bg-emerald-600 text-white rounded-full shadow-lg border border-slate-700 backdrop-blur transition-all"
                  title="Scroll to Bottom"
               >
                   <ArrowDownCircle size={24} />
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