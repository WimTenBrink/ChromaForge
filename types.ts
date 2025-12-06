

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'GEMINI_REQ' | 'GEMINI_RES' | 'IMAGEN_REQ' | 'IMAGEN_RES';
export type SidebarTab = 'UPLOADS' | 'VALIDATING' | 'JOBS' | 'QUEUE' | 'FAILED' | 'BLOCKED';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  title: string;
  details: any;
}

export interface JobLogEntry {
  jobId: string;
  timestamp: string;
  sourceFilename: string;
  generatedFilename: string;
  prompt: string;
  optionsDescription: string;
}

export interface AppOptions {
  gender: string[];
  age: string[];
  bodyType: string[];
  breastSize: string[];
  skin: string[];
  hair: string[];
  eyeColor: string[];
  emotions: string[];
  clothes: string[];
  bondage: string[]; // New dedicated field
  shoes: string[];
  species: string[];
  animals: string[]; // New field for Animals
  technology: string[];
  environment: string[];
  timeOfDay: string[];
  weather: string[];
  aspectRatio: string[];
  items: string[];
  actions: string[];
  // New Creative Options
  artStyle: string[];
  lighting: string[];
  camera: string[];
  mood: string[];
  decorations: string[];
  skinConditions: string[];
  
  // D&D Class Options
  dndClass: string[]; // Generic Class Archetype
  dndFighterOutfit: string[];
  dndFighterWeapon: string[];
  dndClericOutfit: string[];
  dndClericWeapon: string[];
  dndPaladinOutfit: string[];
  dndPaladinWeapon: string[];
  dndRogueOutfit: string[];
  dndRogueWeapon: string[];
  dndWizardOutfit: string[];
  dndWizardWeapon: string[];
  dndMonkOutfit: string[];
  dndMonkWeapon: string[];
  dndBarbarianOutfit: string[];
  dndBarbarianWeapon: string[];
  dndDruidOutfit: string[];
  dndDruidWeapon: string[];

  replaceBackground: boolean;
  removeCharacters: boolean;
  modesty: string;
  
  // Settings
  retryLimit: number;
  safetyRetryLimit: number;
  concurrentJobs: number;
  outputFormat: string;
  imageQuality: string;

  // Tracks which categories should have their selected options combined into a single prompt 
  // instead of generating permutations.
  combinedGroups: string[];
}

export interface GlobalConfig {
  speciesGroups: Record<string, string[]>;
  animalGroups: Record<string, string[]>; // New config group
  environmentGroups: Record<string, string[]>;
  itemGroups: Record<string, string[]>;
  decorationGroups: Record<string, string[]>;
  attireGroups: Record<string, string[]>;
  bondageGroups: Record<string, string[]>; // New config group
  skinConditionGroups: Record<string, string[]>;
  // D&D Configuration
  dndOutfits: Record<string, string[]>;
  dndWeapons: Record<string, string[]>;
  lists: {
      gender: string[];
      age: string[];
      bodyType: string[];
      breastSize: string[];
      skin: string[];
      hair: string[];
      eyeColor: string[];
      emotions: string[];
      shoes: string[];
      technology: string[];
      timeOfDay: string[];
      weather: string[];
      aspectRatio: string[];
      artStyle: string[];
      lighting: string[];
      camera: string[];
      mood: string[];
      actions: string[];
      dndClass: string[];
  };
}

export interface ImageAnalysis {
  title: string;
  description: string;
  objects: string[];
  safety: string;
  markdownContent: string;
}

// Source Image Container (File Data)
export interface SourceImage {
    id: string;
    file: File | null;
    originalUploadName?: string; // Track original filename for duplicate detection
    base64Data: string;
    name: string;
    type: string;
    previewUrl: string;
    analysis?: ImageAnalysis;
    status?: 'VALIDATING' | 'READY';
    activityLog: JobLogEntry[];
}

// Job (Execution Unit)
export interface Job {
  id: string;
  sourceImageId: string;
  
  // Configuration
  originalFilename: string;
  prompt: string;
  optionsSummary: string;
  aspectRatio?: string;
  optionsSnapshot: AppOptions;

  // State
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  retryCount: number;
  error?: string;
  
  // Result
  resultUrl?: string;
  generatedTitle?: string;
  timestamp?: number;
}

export interface GeneratedImage {
  id: string;
  sourceImageId: string;
  url: string;
  prompt: string;
  optionsUsed: string;
  originalFilename: string;
  timestamp: number;
  optionsSnapshot: AppOptions;
}

export interface FailedItem {
  id: string;
  jobId: string;
  sourceImageId: string;
  sourceImagePreview: string;
  optionsSummary: string;
  error: string;
  originalJob?: Job;
  retryCount: number;
}

export interface ValidationJob {
    id: string;
    sourceImageId: string;
    file: File;
    optionsSnapshot: AppOptions;
}

export interface InputImage {
    // Legacy support for DB types if needed, but primarily mapped to SourceImage + Jobs now
    id: string;
    status: string;
}