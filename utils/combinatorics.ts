import { AppOptions, GlobalConfig } from "../types";
import { DND_CLASSES } from "../constants";

// Helper to determine buckets for smart grouping
// Returns a map of GroupKey -> SelectedValues[]
// Unmatched values go to 'Misc'
const getSmartGroupBuckets = (
    selectedItems: string[], 
    groupsConfig: Record<string, string[]> | undefined
) => {
    const buckets: Record<string, string[]> = {};
    
    if (!groupsConfig) {
        buckets['default'] = selectedItems;
        return buckets;
    }

    // Invert the config for O(1) lookup: OptionValue -> GroupName
    const itemToGroup: Record<string, string> = {};
    Object.entries(groupsConfig).forEach(([groupName, items]) => {
        items.forEach(item => {
            itemToGroup[item] = groupName;
        });
    });

    selectedItems.forEach(item => {
        const group = itemToGroup[item] || `Misc_${item}`; // Unique group for misc items to preserve their perm behavior
        if (!buckets[group]) buckets[group] = [];
        buckets[group].push(item);
    });

    return buckets;
};

/**
 * Calculates the number of permutations.
 * Updates to include smart grouping logic.
 */
export const countPermutations = (options: AppOptions, config: GlobalConfig | null): number => {
    // 1. Calculate Base Permutations (Standard Options)
    const allKeys = Object.keys(options) as (keyof AppOptions)[];
    
    // Categories that use smart grouping (Additive if different groups)
    const smartGroupCategories: (keyof AppOptions)[] = ['skinConditions', 'decorations', 'bondage', 'items', 'superhero'];

    // Base keys: Arrays, not combinedGroups control, not dnd (except dndClass), and NOT smart group categories
    const baseKeys = allKeys.filter(key => 
        key !== 'combinedGroups' && 
        Array.isArray(options[key]) && 
        (!key.startsWith('dnd') || key === 'dndClass') &&
        !smartGroupCategories.includes(key)
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

    // 2. Smart Group Permutations
    // For these categories, we split selected items into buckets.
    // Each bucket contributes to permutations multiplicatively.
    // Example: Face:[Mud] (1) * Arms:[Blood, Oil] (2) = 2 Permutations
    if (config) {
        smartGroupCategories.forEach(key => {
            const val = options[key] as string[];
            if (val.length > 0) {
                if (options.combinedGroups.includes(key)) {
                     baseCount *= 1;
                } else {
                    // Determine bucket logic based on key
                    let groups: Record<string, string[]> | undefined;
                    if (key === 'skinConditions') groups = config.skinConditionGroups;
                    if (key === 'decorations') groups = config.decorationGroups;
                    if (key === 'bondage') groups = config.bondageGroups;
                    if (key === 'items') groups = config.itemGroups;
                    if (key === 'superhero') groups = config.superheroGroups;

                    const buckets = getSmartGroupBuckets(val, groups);
                    
                    // Multiply base count by the size of each bucket
                    Object.values(buckets).forEach(bucketItems => {
                        baseCount *= bucketItems.length;
                    });
                }
            }
        });
    } else {
        // Fallback if no config (treat as standard)
        smartGroupCategories.forEach(key => {
             const val = options[key] as string[];
             if (val.length > 0 && !options.combinedGroups.includes(key)) {
                 baseCount *= val.length;
             }
        });
    }

    // 3. Calculate D&D Permutations (Union of Classes - Specific Gear)
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
export const generatePermutations = (options: AppOptions, config: GlobalConfig | null) => {
  const allKeys = Object.keys(options) as (keyof AppOptions)[];
  
  const smartGroupCategories: (keyof AppOptions)[] = ['skinConditions', 'decorations', 'bondage', 'items', 'superhero'];

  // Base keys: Normal options that are strictly permutations
  const baseKeys = allKeys.filter(key => 
    key !== 'combinedGroups' && 
    Array.isArray(options[key]) && 
    (!key.startsWith('dnd') || key === 'dndClass') &&
    !smartGroupCategories.includes(key)
  );

  const processingList: { key: string; values: any[] }[] = [];
  
  // 1. Process Base Keys
  baseKeys.forEach(key => {
      const val = options[key] as string[];
      if (val.length === 0) return;

      if (options.combinedGroups.includes(key)) {
          processingList.push({ key, values: [val.join(' + ')] });
      } else {
          processingList.push({ key, values: val });
      }
  });

  // 2. Process Smart Group Keys (Skin, Decor, etc.)
  smartGroupCategories.forEach(key => {
      const val = options[key] as string[];
      if (val.length === 0) return;

      if (options.combinedGroups.includes(key)) {
           // Combined manually: Treat as one single merged value
           processingList.push({ key, values: [val.join(' + ')] });
      } else if (config) {
            // Smart Grouping Logic
            let groups: Record<string, string[]> | undefined;
            if (key === 'skinConditions') groups = config.skinConditionGroups;
            if (key === 'decorations') groups = config.decorationGroups;
            if (key === 'bondage') groups = config.bondageGroups;
            if (key === 'items') groups = config.itemGroups;
            if (key === 'superhero') groups = config.superheroGroups;

            const buckets = getSmartGroupBuckets(val, groups);

            // Each bucket becomes a virtual key for the cartesian product
            // e.g. skinConditions_Face: ['Mud'], skinConditions_Arms: ['Blood', 'Oil']
            Object.entries(buckets).forEach(([bucketKey, items]) => {
                const virtualKey = `${key}_SMART_${bucketKey}`; // temp key
                processingList.push({ key: virtualKey, values: items });
            });
      } else {
           // Fallback if no config
           processingList.push({ key, values: val });
      }
  });

  // Helper to calculate cartesian product
  const cartesian = (a: any[], b: any[]) => [].concat(...a.map((d: any) => b.map((e: any) => [].concat(d, e))));
  
  // 3. Generate Base Combinations
  let baseCombinations: any[] = [{}];
  
  if (processingList.length > 0) {
      const arraysToPermute = processingList.map(p => p.values);
      let product: any[] = arraysToPermute[0];
      if (arraysToPermute.length > 1) {
          product = arraysToPermute.reduce((a, b) => cartesian(a, b));
      }
      
      const rawCombinations = (Array.isArray(product[0]) ? product : product.map((p: any) => [p])) as any[][];
      
      baseCombinations = rawCombinations.map(vals => {
          const obj: any = {};
          
          // Reconstruct object
          vals.forEach((v, i) => {
              const pKey = processingList[i].key;
              
              if (pKey.includes('_SMART_')) {
                  // This is a virtual key from Smart Grouping.
                  // We need to merge it back into the main key.
                  const realKey = pKey.split('_SMART_')[0];
                  if (!obj[realKey]) {
                      obj[realKey] = v;
                  } else {
                      obj[realKey] = `${obj[realKey]} + ${v}`; // Additive merge
                  }
              } else {
                  obj[pKey] = v;
              }
          });
          return obj;
      });
  }

  // 4. Generate D&D Class Combinations
  let dndCombinations: any[] = [];
  
  DND_CLASSES.forEach(cls => {
      const outfitKey = `dnd${cls}Outfit` as keyof AppOptions;
      const weaponKey = `dnd${cls}Weapon` as keyof AppOptions;
      
      const rawOutfits = options[outfitKey] as string[] || [];
      const rawWeapons = options[weaponKey] as string[] || [];
      
      if (rawOutfits.length === 0 && rawWeapons.length === 0) return;

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

      if (outfits.length > 0 && weapons.length > 0) {
          outfits.forEach(o => {
              weapons.forEach(w => {
                  dndCombinations.push({
                      [outfitKey]: o,
                      [weaponKey]: w
                  });
              });
          });
      } else if (outfits.length > 0) {
          outfits.forEach(o => {
              dndCombinations.push({ [outfitKey]: o });
          });
      } else if (weapons.length > 0) {
          weapons.forEach(w => {
              dndCombinations.push({ [weaponKey]: w });
          });
      }
  });

  if (dndCombinations.length === 0) {
      dndCombinations.push({}); 
  }

  // 5. Cross Product Base x D&D
  const finalCombinations: any[] = [];
  
  baseCombinations.forEach(base => {
      dndCombinations.forEach(dnd => {
          const combo = {
              ...base,
              ...dnd
          };
          
          if (options.replaceBackground) combo.replaceBackground = true;
          if (options.removeCharacters) combo.removeCharacters = true;
          if (options.modesty) combo.modesty = options.modesty;
          
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

export const buildPromptFromCombo = (combo: any, characterName: string = "Unknown Character"): string => {
  // Conditionally build lines only for present options
  const details: string[] = [];
  let requiresNudityCoverage = false;
  
  // Only add character details if we are NOT removing characters
  if (!combo.removeCharacters) {
      if (shouldInclude(combo.species)) details.push(`- Species: ${combo.species}`);
      if (shouldInclude(combo.animals)) details.push(`- Animal/Creature Species: ${combo.animals}`);
      if (shouldInclude(combo.dndClass)) details.push(`- D&D Class Archetype: ${combo.dndClass}`);
      if (shouldInclude(combo.gender)) details.push(`- Gender: ${combo.gender}`);
      if (shouldInclude(combo.age)) details.push(`- Age: ${combo.age}`);
      if (shouldInclude(combo.bodyType)) details.push(`- Body Type: ${combo.bodyType}`);
      if (shouldInclude(combo.breastSize)) details.push(`- Breast Size: ${combo.breastSize}`);
      if (shouldInclude(combo.skin)) details.push(`- Skin: ${combo.skin}`);
      if (shouldInclude(combo.hair)) details.push(`- Hair: ${combo.hair}`);
      if (shouldInclude(combo.eyeColor)) details.push(`- Eye Color: ${combo.eyeColor}`);
      if (shouldInclude(combo.emotions)) details.push(`- Emotion/Expression: ${combo.emotions}`);
      if (shouldInclude(combo.superhero)) details.push(`- Superpowers/Abilities: ${combo.superhero}`);
      
      if (shouldInclude(combo.clothes)) {
          // Check for implied nudity keywords to trigger safety instruction
          const clothesLower = String(combo.clothes).toLowerCase();
          const isImpliedNude = 
              clothesLower.includes("nude") || 
              clothesLower.includes("body paint") || 
              clothesLower.includes("strategic") ||
              clothesLower.includes("sheet") || 
              clothesLower.includes("towel") ||
              clothesLower.includes("covered in") ||
              clothesLower.includes("draped") ||
              clothesLower.includes("bandages") ||
              clothesLower.includes("silhouette") ||
              clothesLower.includes("sheer") ||
              clothesLower.includes("topless") ||
              clothesLower.includes("bottomless");
          
          if (isImpliedNude) {
             requiresNudityCoverage = true;
             details.push(`- Attire: NUDE / UNCLOTHED.`);
             details.push(`- Concept: ${combo.clothes}`);
             details.push(`- IMPORTANT: The character is NUDE. The '${combo.clothes}' is the ONLY covering. Do NOT add shirts, pants, underwear, bras, or standard clothing.`);
          } else {
             details.push(`- Clothes/Attire: ${combo.clothes}`);
          }
      }

      // Add Bondage / Restraint Details
      if (shouldInclude(combo.bondage)) {
          details.push(`- Restraints/Bondage: ${combo.bondage}`);
          // Bondage often implies partial nudity or specific safety overrides
          requiresNudityCoverage = true;
          details.push(`- Bondage Context: Ensure the restraints (${combo.bondage}) are clearly visible. To facilitate this, remove standard clothing. The character should be NUDE or 'implied nude' to show the ropes/chains on the skin.`);
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
    // Normal ratios (numeric x:y or NxN)
    if (combo.aspectRatio.match(/^\d+:\d+$/) || combo.aspectRatio.match(/^\d+x\d+$/)) {
         setting.push(`- Aspect Ratio: ${combo.aspectRatio} (Crop or extend the composition to strictly match this ratio if necessary)`);
    } else {
         // Special Formats
         setting.push(`- Special Format: ${combo.aspectRatio}`);
         if (combo.aspectRatio.includes("Magic TCG")) {
             setting.push("  * LAYOUT: Fantasy Trading Card style. Vertical composition (approx 3:4). Ensure the subject fits within the card frame boundaries. Add a fantasy border/frame.");
         } else if (combo.aspectRatio.includes("Baseball Card")) {
             setting.push("  * LAYOUT: Sports Trading Card style. Vertical composition (approx 3:4). Add a vintage or modern card border.");
         } else if (combo.aspectRatio.includes("Tarot")) {
             setting.push("  * LAYOUT: Tarot Card. Tall vertical composition (approx 9:16). Elaborate decorative borders are encouraged.");
         } else if (combo.aspectRatio.includes("Circular Token")) {
             setting.push("  * LAYOUT: VTT Token. The subject MUST be enclosed in a decorative CIRCULAR frame. The output image is square (1:1), but the relevant content is the circle. The corners should be transparent or dark.");
         } else if (combo.aspectRatio.includes("Oval Portrait")) {
             setting.push("  * LAYOUT: Oval Portrait. The subject is enclosed in an ornate OVAL frame. Vertical orientation.");
         } else if (combo.aspectRatio.includes("Polaroid")) {
             setting.push("  * LAYOUT: Instant Film Photo. Include the classic thick white border frame of a Polaroid picture.");
         } else if (combo.aspectRatio.includes("Cinematic")) {
             setting.push("  * LAYOUT: Ultra Widescreen Cinematic (2.35:1). Letterboxing (black bars) is acceptable to achieve the ratio within a 16:9 image.");
         } else if (combo.aspectRatio.includes("D&D Character Sheet")) {
             setting.push("  * LAYOUT: Dungeons & Dragons Character Sheet.");
             setting.push(`  * TOP TEXT: Name. Write the name '${characterName}' at the top. If '${characterName}' describes a generic object or archetype (e.g. 'Elf Warrior', 'Untitled'), INVENT a unique fantasy name instead.`);
             const cls = combo.dndClass && shouldInclude(combo.dndClass) ? combo.dndClass : "Unknown";
             if (cls === "Unknown") {
                 setting.push(`  * BOTTOM TEXT: Class. Infer the D&D Class from the visual equipment (e.g. 'Fighter', 'Wizard', 'Rogue') and write it at the bottom.`);
             } else {
                 setting.push(`  * BOTTOM TEXT: Class: '${cls}'. Write this clearly at the bottom.`);
             }
             setting.push("  * STYLE: Parchment texture background, decorative border, clear text visibility.");
         }
    }
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
    ? "7. CONTENT SAFETY: The user has explicitly requested ARTISTIC NUDITY or Bondage. Do NOT enable clothing filters. The character MUST BE NUDE. Use chiaroscuro (shadows), camera angles, hair, or objects to obscure genitals/nipples naturally for safety compliance, but DO NOT ADD CLOTHES."
    : "";

  let modestyInstruction = "";
  if (requiresNudityCoverage && combo.modesty && combo.modesty !== 'None') {
      switch (combo.modesty) {
          case 'Left Hand Cover':
              modestyInstruction = "MODESTY STRATEGY: The character must use their LEFT HAND to cover their genital area. Remove any objects from the left hand to ensure it is empty for coverage.";
              break;
          case 'Right Hand Cover':
              modestyInstruction = "MODESTY STRATEGY: The character must use their RIGHT HAND to cover their genital area. Remove any objects from the right hand to ensure it is empty for coverage.";
              break;
          case 'Both Hands Cover':
              modestyInstruction = "MODESTY STRATEGY: The character must use BOTH HANDS for coverage. One hand must cover the genital area, and the other must cover a breast. Remove objects from both hands.";
              break;
          case 'Strategic Object':
              modestyInstruction = "MODESTY STRATEGY: Use a strategically placed object (like a vase, weapon, fabric, or environment element) to visually block the genital area.";
              break;
          case 'Transparent Veil':
              modestyInstruction = "MODESTY STRATEGY: Drape a sheer, transparent veil or silk fabric over the torso and hips to provide a layer of covering while maintaining visibility.";
              break;
          case 'Long Hair Cover':
             modestyInstruction = "MODESTY STRATEGY: Use long, flowing hair to naturally obscure the nipples and genital area.";
             break;
          case 'Crossed Legs':
             modestyInstruction = "MODESTY STRATEGY: Pose the character with crossed legs (standing or sitting) or a knee lift to conceal the genital area.";
             break;
          case 'Heavy Shadow':
             modestyInstruction = "MODESTY STRATEGY: Use deep, high-contrast shadows (chiaroscuro) to hide the private areas in darkness.";
             break;
           case 'Steam/Mist':
             modestyInstruction = "MODESTY STRATEGY: Use swirling steam, mist, or fog to obscure the private areas.";
             break;
      }
  }

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
    1. STRICT POSE ADHERENCE: The input image is the absolute reference for structure, pose, and composition. You are coloring this specific line art, NOT generating a new image from scratch. DO NOT alter the pose. DO NOT rotate the subject or camera. DO NOT change limb positions. The output must align perfectly with the input sketches. Only options can override specific textures or details (e.g. changing clothes), but the underlying pose is sacred.
    2. ATTIRE OVERRIDE: The user's chosen 'Attire' or 'Clothes' option is ABSOLUTE. If the original image depicts clothing that conflicts with the selection (e.g., original has a dress, option is 'Bikini'), you MUST REMOVE the original clothing and render the selected attire. Modify the underlying body structure if necessary to show skin that was previously covered, while keeping the original pose.
    3. Apply the 'Species' setting (if specified) to the main humanoid character. If 'Animal/Creature' is specified, apply that to the main subject.
    4. Ensure strict logical consistency between the Technology/Environment and the Character's attire/class. 
    ${modeInstruction}
    6. If an option is not set (missing from the lists above), do not use it or infer it arbitrarily; use the original image content as the guide for that aspect.
    7. Preserve facial details, expressions, and features from the original line art.
    8. SKELETAL INTEGRITY: If the original line art depicts skeletal structures (e.g. skull face, exposed ribs, skeletal hands), PRESERVE THEM AS EXPOSED BONE. Do not cover clearly drawn bones with skin or flesh. Render them as realistic bone material integrated into the character.
    ${coverageInstruction}
    ${modestyInstruction}
    
    Output a single, high-quality, photorealistic image.
  `.trim();
};