import { AppOptions } from "./types";

export const DEFAULT_OPTIONS: AppOptions = {
  gender: ['Female'],
  age: ['Young Adult'],
  skin: ['Fair'],
  hair: ['Blonde'],
  clothes: ['Casual'],
  shoes: ['Boots'],
  technology: ['Contemporary'],
  environment: ['City'],
  timeOfDay: ['Noon']
};

export const OPTION_LISTS = {
  gender: ['Male', 'Female', 'Intersex'],
  age: ['Preteen', 'Teen', 'Young Adult', 'Adult', 'Mature', 'Old'],
  skin: ['Albino', 'Pale', 'Fair', 'Tan', 'Brown', 'Dark Brown', 'Black', 'Blueish', 'Greenish'],
  hair: ['Blonde', 'Brunette', 'Black', 'Red', 'White', 'Grey', 'Blue', 'Pink', 'Green', 'Bald'],
  clothes: ['Nude (Implied)', 'Underwear', 'Casual', 'Formal', 'Uniform', 'Space Suit', 'Armor', 'Fantasy Robes', 'Cyberpunk Gear', 'Rags'],
  shoes: ['Barefoot', 'Barefoot with Anklets', 'Sandals', 'Sneakers', 'Shoes', 'Boots', 'High Heels', 'Space Boots', 'Greaves'],
  technology: ['Stone Age', 'Bronze Age', 'Medieval', 'Renaissance', 'Industrial', 'Contemporary', 'Near Future', 'Cyberpunk', 'Far Future', 'Intergalactic'],
  environment: ['Beach', 'River', 'Forest', 'Mountain', 'Desert', 'City', 'Village', 'Castle', 'Ruins', 'Spacecraft', 'Space Station', 'Remote Planet', 'Deep Space', 'Underwater'],
  timeOfDay: ['Dawn', 'Morning', 'Noon', 'Afternoon', 'Golden Hour', 'Evening', 'Sunset', 'Twilight', 'Midnight']
};

export const MAX_CONCURRENT_JOBS = 2;