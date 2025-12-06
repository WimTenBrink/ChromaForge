

import { AppOptions } from "./types";

export const DEFAULT_OPTIONS: AppOptions = {
  gender: ['Female'],
  age: [],
  bodyType: [],
  breastSize: [],
  skin: [],
  hair: [],
  eyeColor: [],
  emotions: [],
  clothes: [],
  bondage: [], // New field
  shoes: [],
  species: [],
  animals: [], // New field
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
  
  // D&D Defaults
  dndClass: [],
  dndFighterOutfit: [],
  dndFighterWeapon: [],
  dndClericOutfit: [],
  dndClericWeapon: [],
  dndPaladinOutfit: [],
  dndPaladinWeapon: [],
  dndRogueOutfit: [],
  dndRogueWeapon: [],
  dndWizardOutfit: [],
  dndWizardWeapon: [],
  dndMonkOutfit: [],
  dndMonkWeapon: [],
  dndBarbarianOutfit: [],
  dndBarbarianWeapon: [],
  dndDruidOutfit: [],
  dndDruidWeapon: [],

  replaceBackground: false,
  removeCharacters: false,
  modesty: 'None',
  
  // Settings Defaults
  retryLimit: 5,
  safetyRetryLimit: 2,
  concurrentJobs: 5,
  outputFormat: 'image/png',
  imageQuality: '4K',

  combinedGroups: []
};

export const MAX_CONCURRENT_JOBS = 5; // Legacy constant, overriden by options

export const DND_CLASSES = [
    'Fighter', 
    'Cleric', 
    'Paladin', 
    'Monk', 
    'Rogue', 
    'Wizard', 
    'Barbarian', 
    'Druid'
];