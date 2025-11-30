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
  timeOfDay: []
};

export const OPTION_LISTS = {
  gender: ['Male', 'Female', 'Intersex', 'Non-binary'],
  age: ['Child', 'Preteen', 'Teen', 'Young Adult', 'Adult', 'Mature', 'Old', 'Ancient'],
  skin: ['Albino', 'Pale', 'Fair', 'Tan', 'Brown', 'Dark Brown', 'Black', 'Blueish', 'Greenish', 'Reddish', 'Metallic'],
  hair: ['Blonde', 'Brunette', 'Black', 'Red', 'White', 'Grey', 'Blue', 'Pink', 'Green', 'Purple', 'Bald'],
  species: [
    // Star Wars
    'Twi\'lek', 'Togruta', 'Zabrak', 'Wookiee', 'Mandalorian', 'Rodian', 'Kel Dor', 'Mirialan', 'Mon Calamari', 'Jawa', 'Ewok', 'Chiss',
    // Star Trek
    'Vulcan', 'Klingon', 'Andorian', 'Borg', 'Trill', 'Orion', 'Ferengi', 'Romulan', 'Cardassian', 'Bajoran', 'Gorn',
    // D&D / Fantasy
    'Elf', 'Drow', 'Orc', 'Tiefling', 'Dragonborn', 'Tabaxi', 'Gnome', 'Dwarf', 'Half-Orc', 'Genasi', 'Goblin', 'Halfling', 'Aasimar', 'Firbolg',
    // LOTR
    'Hobbit', 'Uruk-hai', 'High Elf', 'Wood Elf',
    // Avatar
    'Na\'vi (Forest)', 'Na\'vi (Reef)',
    // Mass Effect
    'Asari', 'Turian', 'Krogan', 'Salarian', 'Quarian', 'Drell',
    // Halo
    'Sangheili (Elite)', 'Spartan', 'Unggoy (Grunt)',
    // Warcraft
    'Night Elf', 'Draenei', 'Blood Elf', 'Tauren', 'Undead', 'Troll', 'Worgen',
    // Elder Scrolls
    'Khajiit', 'Argonian', 'Dunmer', 'Altmer', 'Bosmer',
    // Generic / Sci-Fi / Horror
    'Human', 'Cyborg', 'Android', 'Zombie', 'Vampire', 'Werewolf', 'Fairy', 'Mermaid', 'Angel', 'Demon', 'Succubus', 'Centaur', 'Alien Grey', 'Reptilian'
  ],
  clothes: ['Nude (Implied)', 'Underwear', 'Casual', 'Formal', 'Uniform', 'Space Suit', 'Armor', 'Fantasy Robes', 'Cyberpunk Gear', 'Rags', 'Swimwear', 'Steampunk Attire', 'Tribal Garb'],
  shoes: ['Barefoot', 'Barefoot with Anklets', 'Sandals', 'Sneakers', 'Shoes', 'Boots', 'High Heels', 'Space Boots', 'Greaves', 'Wraps'],
  technology: ['Stone Age', 'Bronze Age', 'Iron Age', 'Medieval', 'Renaissance', 'Industrial', 'Contemporary', 'Near Future', 'Cyberpunk', 'Far Future', 'Intergalactic'],
  environment: ['Beach', 'River', 'Forest', 'Jungle', 'Mountain', 'Desert', 'Tundra', 'City', 'Village', 'Castle', 'Ruins', 'Spacecraft', 'Space Station', 'Remote Planet', 'Deep Space', 'Underwater', 'Volcano'],
  timeOfDay: ['Dawn', 'Morning', 'Noon', 'Afternoon', 'Golden Hour', 'Evening', 'Sunset', 'Blue Hour', 'Twilight', 'Midnight']
};

export const MAX_CONCURRENT_JOBS = 2;