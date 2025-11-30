
import { AppOptions } from "./types";

export const DEFAULT_OPTIONS: AppOptions = {
  gender: ['Female'],
  age: [],
  skin: [],
  hair: [],
  clothes: ['Underwear'],
  shoes: ['Barefoot'],
  species: [],
  technology: [],
  environment: [],
  timeOfDay: [],
  aspectRatio: ['Original'],
  items: [],
  // New defaults
  artStyle: [],
  lighting: [],
  camera: [],
  mood: [],
  
  replaceBackground: false
};

export const MAX_CONCURRENT_JOBS = 2;
