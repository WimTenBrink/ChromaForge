import { AppOptions } from "./types";

export const DEFAULT_OPTIONS: AppOptions = {
  gender: ['Female'],
  age: [],
  bodyType: [],
  skin: [],
  hair: [],
  eyeColor: [],
  emotions: [],
  clothes: [],
  shoes: [],
  species: [],
  technology: [],
  environment: [],
  timeOfDay: [],
  weather: [],
  aspectRatio: ['Original'],
  items: [],
  actions: [],
  // New defaults
  artStyle: ['Photorealistic'],
  lighting: [],
  camera: [],
  mood: [],
  decorations: [],
  skinConditions: [],
  
  replaceBackground: false,
  removeCharacters: false,
  
  combinedGroups: []
};

export const MAX_CONCURRENT_JOBS = 3;