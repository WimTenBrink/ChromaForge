

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
  
  combinedGroups: []
};

export const MAX_CONCURRENT_JOBS = 3;

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