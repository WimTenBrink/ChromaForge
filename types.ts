

export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'GEMINI_REQ' | 'GEMINI_RES' | 'IMAGEN_REQ' | 'IMAGEN_RES';

export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  title: string;
  details: any;
}

export interface AppOptions {
  gender: string[];
  age: string[];
  skin: string[];
  hair: string[];
  clothes: string[];
  shoes: string[];
  species: string[];
  technology: string[];
  environment: string[];
  timeOfDay: string[];
  weather: string[];
  aspectRatio: string[];
  items: string[];
  // New Creative Options
  artStyle: string[];
  lighting: string[];
  camera: string[];
  mood: string[];
  decorations: string[];
  
  replaceBackground: boolean;
  removeCharacters: boolean;
  
  // Tracks which categories should have their selected options combined into a single prompt 
  // instead of generating permutations.
  combinedGroups: string[];
}

export interface GlobalConfig {
  speciesGroups: Record<string, string[]>;
  environmentGroups: Record<string, string[]>;
  itemGroups: Record<string, string[]>;
  decorationGroups: Record<string, string[]>;
  attireGroups: Record<string, string[]>;
  lists: {
      gender: string[];
      age: string[];
      skin: string[];
      hair: string[];
      shoes: string[];
      technology: string[];
      timeOfDay: string[];
      weather: string[];
      aspectRatio: string[];
      artStyle: string[];
      lighting: string[];
      camera: string[];
      mood: string[];
  };
}

export interface ImageAnalysis {
  title: string;
  description: string;
  objects: string[];
  safety: string;
  markdownContent: string;
}

export interface InputImage {
  id: string;
  file: File | null; // Null if loaded from storage and file object not reconstructed yet, but we store base64
  base64Data?: string; // For persistence
  name: string;
  type: string;
  previewUrl: string;
  status: 'QUEUED' | 'ANALYZING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  totalVariations: number;
  completedVariations: number;
  title?: string; // Generated title
  analysis?: ImageAnalysis;
}

export interface Job {
  id: string;
  sourceImageId: string;
  sourceImagePreview: string;
  originalFilename: string;
  generatedTitle: string;
  prompt: string;
  optionsSummary: string;
  aspectRatio?: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

export interface GeneratedImage {
  id: string;
  sourceImageId: string;
  url: string;
  prompt: string;
  optionsUsed: string;
  originalFilename: string;
  timestamp: number;
}

export interface FailedItem {
  id: string;
  jobId: string;
  sourceImageId: string;
  sourceImagePreview: string;
  optionsSummary: string;
  error: string;
  originalJob?: Job;
}