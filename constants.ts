

import { AppOptions } from "./types";

export const DEFAULT_OPTIONS: AppOptions = {
  gender: ['Female'],
  age: [],
  skin: [],
  hair: [],
  clothes: [],
  shoes: [],
  species: [],
  technology: [],
  environment: [],
  timeOfDay: [],
  weather: [],
  aspectRatio: ['Original'],
  items: [],
  // New defaults
  artStyle: ['Photorealistic'],
  lighting: [],
  camera: [],
  mood: [],
  decorations: [],
  
  replaceBackground: false,
  removeCharacters: false,
  
  combinedGroups: []
};

export const MAX_CONCURRENT_JOBS = 2;