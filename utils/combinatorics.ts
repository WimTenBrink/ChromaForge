import { AppOptions } from "../types";

/**
 * Generates a Cartesian product of all selected options.
 * Returns an array of objects, where each object represents a unique combination.
 */
export const generatePermutations = (options: AppOptions) => {
  // Only iterate over array properties that are meant for permutations
  // Filter out 'combinedGroups' as it's a control array, not a feature array
  const keys = Object.keys(options).filter(key => 
    key !== 'combinedGroups' && Array.isArray(options[key as keyof AppOptions])
  ) as (keyof AppOptions)[];
  
  // Get the arrays of selected values for each category
  const arrays = keys.map(key => {
    const val = options[key];
    
    // Safety check
    if (!Array.isArray(val) || val.length === 0) {
        return [undefined];
    }

    // COMBINATION LOGIC:
    // If this category is in 'combinedGroups', we treat all selected items as a single "item" 
    // to be used in one image, rather than permuting through them.
    if (options.combinedGroups.includes(key)) {
        const joined = val.join(' + '); // Join with + to indicate combination in prompt
        return [joined];
    }

    // Normal behavior: return the array to generate permutations
    return val;
  });

  // Helper to calculate cartesian product
  const cartesian = (a: any[], b: any[]) => [].concat(...a.map((d: any) => b.map((e: any) => [].concat(d, e))));
  
  // Reduce to generate all combinations
  const product = arrays.reduce((a, b) => cartesian(a, b));

  // If there's only one category or one item, cartesian might handle it differently, 
  // ensure we have an array of arrays.
  const combinations = (Array.isArray(product[0]) ? product : product.map((p: any) => [p])) as any[][];

  return combinations.map(combo => {
    const comboObj: any = {};
    
    // Copy base non-array options (like booleans)
    if (options.replaceBackground) {
        comboObj.replaceBackground = true;
    }
    if (options.removeCharacters) {
        comboObj.removeCharacters = true;
    }

    keys.forEach((key, index) => {
      // Only set if value is not undefined
      if (combo[index] !== undefined) {
          comboObj[key] = combo[index];
      }
    });
    return comboObj;
  });
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
      if (shouldInclude(combo.skin)) details.push(`- Skin: ${combo.skin}`);
      if (shouldInclude(combo.hair)) details.push(`- Hair: ${combo.hair}`);
      if (shouldInclude(combo.eyeColor)) details.push(`- Eye Color: ${combo.eyeColor}`);
      if (shouldInclude(combo.emotions)) details.push(`- Emotion/Expression: ${combo.emotions}`);
      if (shouldInclude(combo.clothes)) {
          details.push(`- Clothes/Attire: ${combo.clothes}`);
          // Check for implied nudity keywords to trigger safety instruction
          // Using lowercase check for robustness against combined strings "Option + Option"
          const clothesLower = String(combo.clothes).toLowerCase();
          if (
              clothesLower.includes("nude") || 
              clothesLower.includes("body paint") || 
              clothesLower.includes("strategic") ||
              clothesLower.includes("sheet") || 
              clothesLower.includes("chained")
          ) {
              requiresNudityCoverage = true;
          }
      }
      if (shouldInclude(combo.shoes)) details.push(`- Shoes: ${combo.shoes}`);
      if (shouldInclude(combo.items)) details.push(`- Item(s) equipped/holding: ${combo.items}`);
      if (shouldInclude(combo.decorations)) details.push(`- Body Decorations/Features: ${combo.decorations}`);
      if (shouldInclude(combo.skinConditions)) details.push(`- Skin Condition/Surface: ${combo.skinConditions}`);
      if (shouldInclude(combo.actions)) details.push(`- Action/Activity: ${combo.actions}`);
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

  if (shouldInclude(combo.aspectRatio) && combo.aspectRatio !== 'Original') {
      setting.push(`- Aspect Ratio: ${combo.aspectRatio}`);
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
    ? "7. IMPLIED NUDITY HANDLING: For the 'Nude (Implied)', 'Chained' or artistic body paint options, maintain an artistic, tasteful look. CRITICAL: Provide minimal coverage to private areas using small elements like a single leaf, a strategically placed object, deep shadow, flowing hair, or flower petals. The nudity should be implied but not explicitly graphic."
    : "";

  return `
    Colorize this line art.
    Turn it into a high-resolution, 4K, photo-realistic photograph (unless Art Style specifies otherwise).
    It must look like a real picture or high-end render.
    
    Character Details:
    ${details.length > 0 ? details.join('\n    ') : 'N/A (Landscape Mode or As-Is)'}
    
    Setting:
    ${setting.join('\n    ')}

    Artistic Direction:
    ${style.join('\n    ')}
    
    IMPORTANT INSTRUCTIONS:
    1. Apply the 'Species' setting (if specified) to the main humanoid character in the line art.
    2. Ensure strict logical consistency between the Technology/Environment and the Character's attire. 
    3. Make sure people in the generated images wear the proper clothes for their technology and the environment, including the clothing option set for the character.
    4. Maintain the original pose and gesture of the character(s) strictly.
    ${modeInstruction}
    6. If an option is not set (missing from the lists above), do not use it or infer it arbitrarily; use the original image content as the guide for that aspect.
    7. IMPORTANT: Preserve all facial details, expressions, and features from the original line art. Do not distort the face.
    ${coverageInstruction}
    
    High quality, detailed, masterpiece.
  `.trim();
};