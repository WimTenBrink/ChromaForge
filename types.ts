
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
  technology: string[];
  environment: string[];
  timeOfDay: string[];
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
  base64Data?: string; // For local storage persistence
  name: string;
  type: string;
  previewUrl: string;
  status: 'QUEUED' | 'ANALYZING' | 'PROCESSING' | 'COMPLETED' | 'PARTIAL';
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
  originalJob: Job;
}
