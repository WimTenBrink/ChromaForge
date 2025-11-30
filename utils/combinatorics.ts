import { AppOptions } from "../types";

/**
 * Generates a Cartesian product of all selected options.
 * Returns an array of objects, where each object represents a unique combination.
 */
export const generatePermutations = (options: AppOptions) => {
  const keys = Object.keys(options) as (keyof AppOptions)[];
  
  // Get the arrays of selected values for each category
  const arrays = keys.map(key => {
    // Return [undefined] if empty so it acts as a single "ignore" pass in the cartesian product
    // rather than resulting in 0 total combinations.
    return options[key].length > 0 ? options[key] : [undefined];
  });

  // Helper to calculate cartesian product
  const cartesian = (a: any[], b: any[]) => [].concat(...a.map((d: any) => b.map((e: any) => [].concat(d, e))));
  
  // Reduce to generate all combinations
  const product = arrays.reduce((a, b) => cartesian(a, b));

  // If there's only one category or one item, cartesian might handle it differently, 
  // ensure we have an array of arrays.
  const combinations = (Array.isArray(product[0]) ? product : product.map((p: any) => [p])) as any[][];

  return combinations.map(combo => {
    const comboObj: Partial<Record<keyof AppOptions, string>> = {};
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
  
  const setting: string[] = [];
  if (combo.technology) setting.push(`- Technology Level: ${combo.technology}`);
  if (combo.environment) setting.push(`- Environment: ${combo.environment}`);
  if (combo.timeOfDay) setting.push(`- Time of Day: ${combo.timeOfDay}`);

  return `
    Colorize this line art.
    Turn it into a photo-realistic image using oil paint colors.
    
    Character Details:
    ${details.join('\n    ')}
    
    Setting:
    ${setting.join('\n    ')}
    
    IMPORTANT INSTRUCTIONS:
    1. Apply the 'Species' setting (if specified) to the main humanoid character in the line art.
    2. Ensure strict logical consistency between the Technology/Environment and the Character's attire. 
    3. Make sure people in the generated images wear the proper clothes for their technology and the environment, including the clothing option set for the character.
    4. If the requested Clothes or Shoes option (e.g. Space Suit) contradicts the Technology Level (e.g. Bronze Age), prioritize the Technology Level and adapt the clothing to fit that era.
    5. No space suits in the Bronze age.
    6. If an option is not set (missing from the lists above), do not use it or infer it arbitrarily; use the original image content as the guide for that aspect.
    
    Maintain the composition of the original line art strictly. High quality, detailed, masterpiece.
  `.trim();
};