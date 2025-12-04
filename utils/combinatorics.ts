

import { AppOptions } from "../types";
import { DND_CLASSES } from "../constants";

/**
 * Calculates the number of permutations without generating the objects.
 * Useful for UI counters.
 */
export const countPermutations = (options: AppOptions): number => {
    // 1. Calculate Base Permutations (Standard Options)
    const allKeys = Object.keys(options) as (keyof AppOptions)[];
    const baseKeys = allKeys.filter(key => 
        key !== 'combinedGroups' && 
        Array.isArray(options[key]) && 
        !key.startsWith('dnd')
    );

    let baseCount = 1;
    baseKeys.forEach(key => {
        const val = options[key] as string[];
        if (val.length > 0) {
            if (options.combinedGroups.includes(key)) {
                baseCount *= 1;
            } else {
                baseCount *= val.length;
            }
        }
    });

    // 2. Calculate D&D Permutations (Union of Classes)
    let dndCount = 0;
    
    DND_CLASSES.forEach(cls => {
        const outfitKey = `dnd${cls}Outfit` as keyof AppOptions;
        const weaponKey = `dnd${cls}Weapon` as keyof AppOptions;
        
        const outfits = options[outfitKey] as string[] || [];
        const weapons = options[weaponKey] as string[] || [];
        
        if (outfits.length === 0 && weapons.length === 0) return;

        let clsOutfitCount = 0;
        if (outfits.length > 0) {
            clsOutfitCount = options.combinedGroups.includes(outfitKey) ? 1 : outfits.length;
        }

        let clsWeaponCount = 0;
        if (weapons.length > 0) {
            clsWeaponCount = options.combinedGroups.includes(weaponKey) ? 1 : weapons.length;
        }

        // Logic: if only outfits selected -> count = outfits
        // if only weapons selected -> count = weapons
        // if both -> count = outfits * weapons
        let clsTotal = 0;
        if (clsOutfitCount > 0 && clsWeaponCount > 0) {
            clsTotal = clsOutfitCount * clsWeaponCount;
        } else if (clsOutfitCount > 0) {
            clsTotal = clsOutfitCount;
        } else if (clsWeaponCount > 0) {
            clsTotal = clsWeaponCount;
        }

        dndCount += clsTotal;
    });

    if (dndCount === 0) dndCount = 1;

    return baseCount * dndCount;
};

/**
 * Generates a Cartesian product of all selected options.
 * Returns an array of objects, where each object represents a unique combination.
 */
export const generatePermutations = (options: AppOptions) => {
  // 1. Identify all active keys in the options object
  const allKeys = Object.keys(options) as (keyof AppOptions)[];
  
  // 2. Separate keys
  // Base keys: Arrays, not combinedGroups control, and NOT starting with 'dnd'
  const baseKeys = allKeys.filter(key => 
    key !== 'combinedGroups' && 
    Array.isArray(options[key]) && 
    !key.startsWith('dnd')
  );

  // 3. Generate Base Processing List
  const baseProcessingList: { key: string; values: any[] }[] = [];
  
  baseKeys.forEach(key => {
      const val = options[key] as string[];
      if (val.length === 0) return; // Skip empty categories

      if (options.combinedGroups.includes(key)) {
          baseProcessingList.push({ key, values: [val.join(' + ')] });
      } else {
          baseProcessingList.push({ key, values: val });
      }
  });

  // Helper to calculate cartesian product
  const cartesian = (a: any[], b: any[]) => [].concat(...a.map((d: any) => b.map((e: any) => [].concat(d, e))));
  
  // 4. Generate Base Combinations
  let baseCombinations: any[] = [{}];
  
  if (baseProcessingList.length > 0) {
      const arraysToPermute = baseProcessingList.map(p => p.values);
      let product: any[] = arraysToPermute[0];
      if (arraysToPermute.length > 1) {
          product = arraysToPermute.reduce((a, b) => cartesian(a, b));
      }
      
      // Ensure array of arrays
      const rawCombinations = (Array.isArray(product[0]) ? product : product.map((p: any) => [p])) as any[][];
      
      baseCombinations = rawCombinations.map(vals => {
          const obj: any = {};
          vals.forEach((v, i) => {
              obj[baseProcessingList[i].key] = v;
          });
          return obj;
      });
  }

  // 5. Generate D&D Class Combinations (Union Logic)
  let dndCombinations: any[] = [];
  
  DND_CLASSES.forEach(cls => {
      const outfitKey = `dnd${cls}Outfit` as keyof AppOptions;
      const weaponKey = `dnd${cls}Weapon` as keyof AppOptions;
      
      const rawOutfits = options[outfitKey] as string[] || [];
      const rawWeapons = options[weaponKey] as string[] || [];
      
      if (rawOutfits.length === 0 && rawWeapons.length === 0) return;

      // Prepare values for this class
      let outfits: string[] = [];
      if (rawOutfits.length > 0) {
          if (options.combinedGroups.includes(outfitKey)) {
              outfits = [rawOutfits.join(' + ')];
          } else {
              outfits = rawOutfits;
          }
      }

      let weapons: string[] = [];
      if (rawWeapons.length > 0) {
          if (options.combinedGroups.includes(weaponKey)) {
              weapons = [rawWeapons.join(' + ')];
          } else {
              weapons = rawWeapons;
          }
      }

      // Generate per-class permutations
      if (outfits.length > 0 && weapons.length > 0) {
          // Cartesian of Outfit x Weapon
          outfits.forEach(o => {
              weapons.forEach(w => {
                  dndCombinations.push({
                      [outfitKey]: o,
                      [weaponKey]: w
                  });
              });
          });
      } else if (outfits.length > 0) {
          // Only Outfits
          outfits.forEach(o => {
              dndCombinations.push({ [outfitKey]: o });
          });
      } else if (weapons.length > 0) {
          // Only Weapons
          weapons.forEach(w => {
              dndCombinations.push({ [weaponKey]: w });
          });
      }
  });

  if (dndCombinations.length === 0) {
      dndCombinations.push({}); // Ensure at least one empty dnd combo exists to multiply with base
  }

  // 6. Cross Product Base x D&D
  // We manually cross them because 'cartesian' helper expects arrays of values, 
  // here we have arrays of objects.
  
  const finalCombinations: any[] = [];
  
  baseCombinations.forEach(base => {
      dndCombinations.forEach(dnd => {
          // Merge logic: spread base, spread dnd, and add flags
          const combo = {
              ...base,
              ...dnd
          };
          
          if (options.replaceBackground) combo.replaceBackground = true;
          if (options.removeCharacters) combo.removeCharacters = true;
          
          finalCombinations.push(combo);
      });
  });

  return finalCombinations;
};

const shouldInclude = (value: string | undefined): boolean => {
    if (!value) return false;
    const v = String(value).toLowerCase();
    return !v.startsWith("as-is") && !v.startsWith("original") && v !== "default" && v !== "none";
};

export const buildPromptFromCombo = (combo: any): string => {
  // Conditionally build lines only for present options
  const details: string[] = [];
  let requiresNudityCoverage = false;
  
  // Only add character details if we are NOT removing characters
  if (!combo.removeCharacters) {
      if (shouldInclude(combo.species)) details.push(`- Species: ${combo.species}`);
      if (shouldInclude(combo.gender)) details.push(`- Gender: ${combo.gender}`);
      if (shouldInclude(combo.age)) details.push(`- Age: ${combo.age}`);
      if (shouldInclude(combo.bodyType)) details.push(`- Body Type: ${combo.bodyType}`);
      if (shouldInclude(combo.breastSize)) details.push(`- Breast Size: ${combo.breastSize}`);
      if (shouldInclude(combo.skin)) details.push(`- Skin: ${combo.skin}`);
      if (shouldInclude(combo.hair)) details.push(`- Hair: ${combo.hair}`);
      if (shouldInclude(combo.eyeColor)) details.push(`- Eye Color: ${combo.eyeColor}`);
      if (shouldInclude(combo.emotions)) details.push(`- Emotion/Expression: ${combo.emotions}`);
      
      if (shouldInclude(combo.clothes)) {
          // Check for implied nudity keywords to trigger safety instruction
          // Using lowercase check for robustness against combined strings "Option + Option"
          const clothesLower = String(combo.clothes).toLowerCase();
          const isImpliedNude = 
              clothesLower.includes("nude") || 
              clothesLower.includes("body paint") || 
              clothesLower.includes("strategic") ||
              clothesLower.includes("sheet") ||
              clothesLower.includes("towel");
          
          if (isImpliedNude) {
             requiresNudityCoverage = true;
             // Use "Appearance" or "Concept" instead of "Clothes" to prevent AI from forcing fabrics
             details.push(`- Body Concept/Attire: ${combo.clothes} (DO NOT ADD EXTRA CLOTHING)`);
          } else {
             details.push(`- Clothes/Attire: ${combo.clothes}`);
          }
      }

      // Add Bondage / Restraint Details
      if (shouldInclude(combo.bondage)) {
          details.push(`- Restraints/Bondage: ${combo.bondage}`);
          // Bondage often implies partial nudity or specific safety overrides
          requiresNudityCoverage = true;
      }

      if (shouldInclude(combo.shoes)) details.push(`- Shoes: ${combo.shoes}`);
      if (shouldInclude(combo.items)) details.push(`- Item(s) equipped/holding: ${combo.items}`);
      if (shouldInclude(combo.decorations)) details.push(`- Body Decorations/Features: ${combo.decorations}`);
      if (shouldInclude(combo.skinConditions)) details.push(`- Skin Condition/Surface: ${combo.skinConditions}`);
      if (shouldInclude(combo.actions)) details.push(`- Action/Activity: ${combo.actions}`);

      // D&D Specifics - Dynamic check
      // We iterate all possible D&D keys present in the combo
      Object.keys(combo).forEach(key => {
          if (key.match(/^dnd.*Outfit$/) && shouldInclude(combo[key])) {
              // Extract class name from key dnd[Class]Outfit
              const className = key.replace('dnd', '').replace('Outfit', '');
              details.push(`- Class ${className} Outfit: ${combo[key]}`);
          }
          if (key.match(/^dnd.*Weapon$/) && shouldInclude(combo[key])) {
              const className = key.replace('dnd', '').replace('Weapon', '');
              details.push(`- Class ${className} Weapon: ${combo[key]}`);
          }
      });
  }
  
  const setting: string[] = [];
  if (shouldInclude(combo.technology)) setting.push(`- Technology Level: ${combo.technology}`);
  if (shouldInclude(combo.environment)) setting.push(`- Environment: ${combo.environment}`);
  if (shouldInclude(combo.timeOfDay)) setting.push(`- Time of Day: ${combo.timeOfDay}`);
  if (shouldInclude(combo.weather)) setting.push(`- Weather: ${combo.weather}`);
  
  const style: string[] = [];
  if (shouldInclude(combo.artStyle)) style.push(`- Art Style: ${combo.artStyle}`);
  if (shouldInclude(combo.lighting)) style.push(`- Lighting: ${combo.lighting}`);
  
  if (shouldInclude(combo.camera)) {
      style.push(`- Camera/Lens: ${combo.camera}`);
      // Explicit instruction for Full Body requests to ensure framing is correct
      if (String(combo.camera).toLowerCase().includes("full body")) {
          style.push("IMPORTANT: Ensure the FULL BODY of the character is visible within the frame, from head to toe.");
      }
  }
  
  if (shouldInclude(combo.mood)) style.push(`- Mood/Atmosphere: ${combo.mood}`);

  // Hybrid Logic Check
  const hybridSpecies = ["Centaur", "Satyr", "Faun", "Onocentaur", "Hippocamp", "Ipotane", "Minotaur", "Sphinx", "Manticore", "Lamia", "Hecatonchires", "Karakoncolos", "Blemmyes", "Cynocephaly"];
  const currentSpecies = String(combo.species || "");
  const isHybrid = hybridSpecies.some(h => currentSpecies.includes(h));

  if (isHybrid) {
      style.push("CRITICAL ANATOMY: Ensure correct proportions for the hybrid creature. The human parts must be proportional to the animal parts (avoid tiny torsos on huge bodies). For Centaurs/Onocentaurs: Human torso on animal body, NO human legs. For Satyrs/Fauns: Human upper body, goat legs.");
  }

  if (shouldInclude(combo.aspectRatio) && combo.aspectRatio !== 'Original') {
      setting.push(`- Aspect Ratio: ${combo.aspectRatio} (Crop or extend the composition to strictly match this ratio if necessary)`);
  }

  let modeInstruction = "";
  if (combo.removeCharacters) {
       modeInstruction = "5. LANDSCAPE MODE: The output must contain NO characters, people, or figures. Focus entirely on the environment/scenery.";
       if (combo.replaceBackground) {
           modeInstruction += " Completely discard the original background line art and generate a new scene based on the Environment settings.";
       } else {
           modeInstruction += " Maintain the original background composition but remove the people. Infill the space where characters were.";
       }
  } else if (combo.replaceBackground) {
       modeInstruction = "5. EXTRACTION MODE: Extract the main character(s) from the original line art. Completely discard the original background. Generate a new background based on the specified Environment. Ensure seamless integration.";
  } else {
       modeInstruction = "5. Maintain the composition of the original line art strictly.";
  }

  const coverageInstruction = requiresNudityCoverage 
    ? "7. CONTENT SAFETY & AESTHETICS: The user has requested an artistic concept involving nudity, bondage, or implied nudity. DO NOT add clothes if the option specifies 'Nude' or 'Bondage' unless explicitly part of the request. HOWEVER, you MUST maintain a 'Safety' standard by using artistic techniques: use chiaroscuro (heavy shadows), strategic placement of hair/ropes/chains, environmental elements, or camera angles to obscure genitals and nipples naturally. The result should be a high-quality, tasteful, artistic masterpiece, not pornography."
    : "";

  return `
    You are a professional concept artist and colorist.
    Task: Transform the provided line art into a hyper-realistic, 8K resolution masterpiece.
    
    VISUAL STYLE:
    - Hyper-realistic textures (skin pores, imperfections, fabric weave, material physics).
    - Cinematic lighting with volumetric atmosphere.
    - Depth of field and realistic camera lens effects.
    - High dynamic range and rich color grading.
    - If the Art Style option is set, blend that style with photorealistic rendering (e.g., "Photorealistic Anime").
    
    Character Details:
    ${details.length > 0 ? details.join('\n    ') : 'N/A (Landscape Mode or As-Is)'}
    
    Setting:
    ${setting.join('\n    ')}

    Artistic Direction:
    ${style.join('\n    ')}
    
    IMPORTANT INSTRUCTIONS:
    1. Apply the 'Species' setting (if specified) to the main humanoid character in the line art.
    2. Ensure strict logical consistency between the Technology/Environment and the Character's attire/class. 
    3. Make sure people in the generated images wear the proper clothes for their technology and the environment, unless the Attire/Bondage option specifies otherwise.
    4. Maintain the original pose and gesture of the character(s) strictly. Do not add new limbs.
    ${modeInstruction}
    6. If an option is not set (missing from the lists above), do not use it or infer it arbitrarily; use the original image content as the guide for that aspect.
    7. IMPORTANT: Preserve all facial details, expressions, and features from the original line art. Do not distort the face.
    ${coverageInstruction}
    
    Output a single, high-quality, photorealistic image.
  `.trim();
};