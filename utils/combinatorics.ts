
import { AppOptions } from "../types";

/**
 * Generates a Cartesian product of all selected options.
 * Returns an array of objects, where each object represents a unique combination.
 */
export const generatePermutations = (options: AppOptions) => {
  // Only iterate over array properties that are meant for permutations
  const keys = Object.keys(options).filter(key => Array.isArray(options[key as keyof AppOptions])) as (keyof AppOptions)[];
  
  // Get the arrays of selected values for each category
  const arrays = keys.map(key => {
    // Return [undefined] if empty so it acts as a single "ignore" pass in the cartesian product
    // rather than resulting in 0 total combinations.
    const val = options[key];
    return (Array.isArray(val) && val.length > 0) ? val : [undefined];
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

    keys.forEach((key, index) => {
      // Only set if value is not undefined
      if (combo[index] !== undefined) {
          comboObj[key] = combo[index];
      }
    });
    return comboObj;
  });
};

export const buildPromptFromCombo = (combo: any): string => {
  // Conditionally build lines only for present options
  const details: string[] = [];
  
  if (combo.species) details.push(`- Species: ${combo.species}`);
  if (combo.gender) details.push(`- Gender: ${combo.gender}`);
  if (combo.age) details.push(`- Age: ${combo.age}`);
  if (combo.skin) details.push(`- Skin: ${combo.skin}`);
  if (combo.hair) details.push(`- Hair: ${combo.hair}`);
  if (combo.clothes) details.push(`- Clothes: ${combo.clothes}`);
  if (combo.shoes) details.push(`- Shoes: ${combo.shoes}`);
  if (combo.items) details.push(`- Item(s) equipped/holding: ${combo.items}`);
  
  const setting: string[] = [];
  if (combo.technology) setting.push(`- Technology Level: ${combo.technology}`);
  if (combo.environment) setting.push(`- Environment: ${combo.environment}`);
  if (combo.timeOfDay) setting.push(`- Time of Day: ${combo.timeOfDay}`);
  
  const style: string[] = [];
  if (combo.artStyle) style.push(`- Art Style: ${combo.artStyle}`);
  if (combo.lighting) style.push(`- Lighting: ${combo.lighting}`);
  if (combo.camera) style.push(`- Camera/Lens: ${combo.camera}`);
  if (combo.mood) style.push(`- Mood/Atmosphere: ${combo.mood}`);

  if (combo.aspectRatio && combo.aspectRatio !== 'Original') {
      setting.push(`- Aspect Ratio: ${combo.aspectRatio}`);
  }

  const bgInstruction = combo.replaceBackground 
    ? "5. EXTRACTION MODE: Extract the main character(s) from the original line art. Completely discard the original background. Generate a new background based on the specified Environment. Ensure seamless integration." 
    : "5. Maintain the composition of the original line art strictly.";

  return `
    Colorize this line art.
    Turn it into a high-resolution, 4K, photo-realistic photograph (unless Art Style specifies otherwise).
    It must look like a real picture or high-end render.
    
    Character Details:
    ${details.join('\n    ')}
    
    Setting:
    ${setting.join('\n    ')}

    Artistic Direction:
    ${style.join('\n    ')}
    
    IMPORTANT INSTRUCTIONS:
    1. Apply the 'Species' setting (if specified) to the main humanoid character in the line art.
    2. Ensure strict logical consistency between the Technology/Environment and the Character's attire. 
    3. Make sure people in the generated images wear the proper clothes for their technology and the environment, including the clothing option set for the character.
    4. If the requested Clothes or Shoes option (e.g. Space Suit) contradicts the Technology Level (e.g. Bronze Age), prioritize the Technology Level and adapt the clothing to fit that era. No space suits in the Bronze age.
    ${bgInstruction}
    6. If an option is not set (missing from the lists above), do not use it or infer it arbitrarily; use the original image content as the guide for that aspect.
    
    High quality, detailed, masterpiece.
  `.trim();
};
