import { AppOptions } from "../types";

/**
 * Generates a Cartesian product of all selected options.
 * Returns an array of objects, where each object represents a unique combination.
 */
export const generatePermutations = (options: AppOptions) => {
  const keys = Object.keys(options) as (keyof AppOptions)[];
  
  // Get the arrays of selected values for each category
  const arrays = keys.map(key => {
    return options[key].length > 0 ? options[key] : ['Default']; // Fallback if empty, though UI should prevent
  });

  // Helper to calculate cartesian product
  const cartesian = (a: any[], b: any[]) => [].concat(...a.map((d: any) => b.map((e: any) => [].concat(d, e))));
  
  // Reduce to generate all combinations
  const product = arrays.reduce((a, b) => cartesian(a, b));

  // If there's only one category or one item, cartesian might handle it differently, 
  // ensure we have an array of arrays.
  const combinations = (Array.isArray(product[0]) ? product : product.map((p: any) => [p])) as string[][];

  return combinations.map(combo => {
    const comboObj: Partial<Record<keyof AppOptions, string>> = {};
    keys.forEach((key, index) => {
      comboObj[key] = combo[index];
    });
    return comboObj;
  });
};

export const buildPromptFromCombo = (combo: any): string => {
  return `
    Colorize this line art.
    Turn it into a photo-realistic image using oil paint colors.
    
    Character Details:
    - Gender: ${combo.gender}
    - Age: ${combo.age}
    - Skin: ${combo.skin}
    - Hair: ${combo.hair}
    - Clothes: ${combo.clothes}
    - Shoes: ${combo.shoes}
    
    Setting:
    - Technology Level: ${combo.technology}
    - Environment: ${combo.environment}
    - Time of Day: ${combo.timeOfDay}
    
    Maintain the composition of the original line art strictly. High quality, detailed, masterpiece.
  `.trim();
};