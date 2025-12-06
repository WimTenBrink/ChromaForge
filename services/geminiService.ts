import { GoogleGenAI, Type, GenerateContentResponse, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { log } from "./logger";
import { ImageAnalysis } from "../types";

// Standardize safety settings across all requests
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
];

// Helper to extract a readable message from any error type
const getErrorMessage = (err: any): string => {
  if (err === undefined || err === null) return "Unknown Error";
  if (typeof err === 'string') return err;
  
  if (err instanceof Error) return err.message;
  
  if (typeof err === 'object') {
      // Check for common API error patterns
      if (err.message) return String(err.message);
      if (err.error && err.error.message) return String(err.error.message); // Google API standard
      if (err.statusText) return `HTTP Error ${err.status || 'Unknown'}: ${err.statusText}`;
      
      // Check for prompt blocking specifically
      if (err.response?.promptFeedback?.blockReason) {
          return `Request blocked: ${err.response.promptFeedback.blockReason}`;
      }

      // If toString returns default object string, try JSON stringify
      if (typeof err.toString === 'function' && err.toString() !== '[object Object]') {
          return err.toString();
      }
      
      try {
          const json = JSON.stringify(err);
          if (json !== '{}') return json;
      } catch {
          // Ignore
      }
      
      return `Object Error (${err.constructor.name})`;
  }
  
  return String(err);
};

// Helper to ensure Error objects are serializable for logs
const formatErrorForLog = (err: any) => {
  const message = getErrorMessage(err);
  let stack = undefined;
  let raw: any = {};

  if (err instanceof Error) {
      stack = err.stack;
      // Capture extra properties on the error object
      const props = Object.getOwnPropertyNames(err);
      props.forEach(prop => {
          if (prop !== 'stack' && prop !== 'message') {
              try {
                // Only copy if serializable
                const val = (err as any)[prop];
                JSON.stringify(val); // Test serialization
                raw[prop] = val;
              } catch {
                raw[prop] = '[Non-serializable]';
              }
          }
      });
  } else {
      try {
          JSON.stringify(err);
          raw = err;
      } catch {
          raw = '[Non-serializable Error Object]';
      }
  }

  return {
      message,
      name: (err as any)?.name || 'Error',
      stack,
      details: raw
  };
};

// Helper to ensure we always throw an Error object with a string message
const ensureError = (err: any): Error => {
    if (err instanceof Error) return err;
    const message = getErrorMessage(err);
    const wrapper = new Error(message);
    (wrapper as any).originalError = err;
    return wrapper;
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
        const result = reader.result as string;
        // Remove data url prefix for API
        const base64 = result.split(',')[1];
        resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
};

const withTimeout = <T>(promise: Promise<T>, ms: number, context: string): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(new Error(`Operation timed out after ${ms/1000}s: ${context}`));
        }, ms);

        promise
            .then(value => {
                clearTimeout(timer);
                resolve(value);
            })
            .catch(reason => {
                clearTimeout(timer);
                reject(reason);
            });
    });
};

const retryOperation = async <T>(operation: () => Promise<T>, maxRetries: number = 3, baseDelay: number = 2000): Promise<T> => {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            // Check for 503 Service Unavailable / Overloaded or 429 Too Many Requests
            const statusCode = error.status || error.code || (error.error && error.error.code);
            const msg = error.message || (error.error && error.error.message) || '';
            
            const isRetryable = 
                statusCode === 503 || 
                statusCode === 429 ||
                msg.includes('overloaded') ||
                msg.includes('503') ||
                msg.includes('Too Many Requests') ||
                msg.includes('timed out'); // Also retry timeouts
            
            if (isRetryable && i < maxRetries - 1) {
                const delay = baseDelay * Math.pow(2, i); // Exponential backoff
                // Simplified log message
                if (i > 0 || statusCode === 429) {
                     log('INFO', `API Busy/Timeout. Retrying in ${delay}ms (Attempt ${i + 1})...`, {});
                }
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
};

// Helper to get image dimensions from base64 string (browser environment)
const getImageDimensions = (base64: string, mimeType: string): Promise<{width: number, height: number}> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.width, height: img.height });
        img.onerror = (err) => reject(err);
        img.src = `data:${mimeType};base64,${base64}`;
    });
};

// Helper to find the closest supported aspect ratio for the model
const getClosestAspectRatio = (width: number, height: number): string => {
    const ratio = width / height;
    const supported = [
        { str: "1:1", val: 1 },
        { str: "3:4", val: 3/4 },
        { str: "4:3", val: 4/3 },
        { str: "9:16", val: 9/16 },
        { str: "16:9", val: 16/9 }
    ];
    
    // Find closest match by absolute difference
    return supported.reduce((prev, curr) => 
        Math.abs(curr.val - ratio) < Math.abs(prev.val - ratio) ? curr : prev
    ).str;
};

// Helper to map complex aspect ratio strings to API supported enum
const mapAspectRatioToApi = (ratio: string): string => {
    if (!ratio || ratio === 'Original') return '1:1'; // Default fallback, though logic handles detection elsewhere
    
    // Direct matches
    const supported = ["1:1", "3:4", "4:3", "9:16", "16:9"];
    if (supported.includes(ratio)) return ratio;

    // Special Mappings
    if (ratio.includes("Magic TCG") || ratio.includes("Baseball") || ratio.includes("Polaroid")) return "3:4";
    if (ratio.includes("Tarot") || ratio.includes("Oval") || ratio.includes("D&D Character")) return "9:16";
    if (ratio.includes("Circular")) return "1:1";
    if (ratio.includes("Cinematic")) return "16:9"; // 16:9 is the widest native supported
    if (ratio === "2:3") return "3:4"; // Approximation
    if (ratio === "3:2") return "4:3"; // Approximation

    return "1:1"; // Ultimate fallback
};

export const processImage = async (file: File | string, prompt: string, mimeTypeInput?: string, aspectRatio?: string, outputFormat: string = 'image/png', imageQuality: string = '4K'): Promise<string> => {
  log('INFO', 'Initializing Gemini Request', { model: 'gemini-3-pro-image-preview', aspectRatio, outputFormat, imageQuality });

  // API Key Check
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
      const err = new Error("API Key not found. Please select a key.");
      log('ERROR', 'API Key Missing', formatErrorForLog(err));
      throw err;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    let base64Image = '';
    let mimeType = mimeTypeInput || 'image/jpeg';

    if (file instanceof File) {
        base64Image = await fileToBase64(file);
        mimeType = file.type;
    } else {
        base64Image = file;
    }

    const requestPayload: any = {
      model: 'gemini-3-pro-image-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          },
          {
            text: prompt
          }
        ]
      },
      config: {
          imageConfig: {
              imageSize: imageQuality
              // outputMimeType removed as it is not supported by gemini-3-pro-image-preview in generateContent
          },
          // Set all safety thresholds to BLOCK_NONE to be as tolerant as possible
          safetySettings: SAFETY_SETTINGS
      }
    };

    // Configure Aspect Ratio
    let apiAspectRatio = "1:1";

    if (!aspectRatio || aspectRatio === 'Original') {
        try {
            const { width, height } = await getImageDimensions(base64Image, mimeType);
            const closestRatio = getClosestAspectRatio(width, height);
            apiAspectRatio = closestRatio;
            log('INFO', 'Auto-detected Aspect Ratio', { width, height, mappedTo: closestRatio });
        } catch (e) {
            log('WARN', 'Failed to detect aspect ratio, defaulting to 1:1', formatErrorForLog(e));
            apiAspectRatio = "1:1";
        }
    } else {
        apiAspectRatio = mapAspectRatioToApi(aspectRatio);
    }
    
    requestPayload.config.imageConfig.aspectRatio = apiAspectRatio;

    log('GEMINI_REQ', 'Sending Generate Content Request', { 
       model: requestPayload.model,
       promptLength: prompt.length,
       imageSize: base64Image.length,
       config: requestPayload.config
    });

    // Use retry wrapper with timeout for the generation call
    // Image generation is slow, give it 180s per try
    const response = await retryOperation<GenerateContentResponse>(() => 
        withTimeout(ai.models.generateContent(requestPayload), 180000, "Image Generation")
    );

    log('GEMINI_RES', 'Received Generate Content Response', { 
        candidatesCount: response.candidates?.length,
        usage: response.usageMetadata,
        finishReason: response.candidates?.[0]?.finishReason
    });

    // Check if candidates exist
    if (!response.candidates || response.candidates.length === 0) {
        const blockReason = (response as any).promptFeedback?.blockReason;
        const msg = blockReason 
            ? `Model blocked request. Reason: ${blockReason}` 
            : 'Model returned no candidates.';
        
        // Sanitize response log
        const safeResponseLog = {
            promptFeedback: (response as any).promptFeedback,
            usageMetadata: response.usageMetadata
        };
        
        log('WARN', 'No candidates in response', { response: safeResponseLog }); // Warn instead of Error to avoid console spam
        throw new Error(msg);
    }

    // Extract image
    let generatedImageBase64: string | null = null;
    let outputMimeType = outputFormat || 'image/png'; 
    let textResponse = '';
    
    const candidate = response.candidates[0];
    const parts = candidate?.content?.parts;
    
    if (parts) {
        for (const part of parts) {
            if (part.inlineData) {
                generatedImageBase64 = part.inlineData.data;
                if (part.inlineData.mimeType) {
                    outputMimeType = part.inlineData.mimeType;
                }
            } else if (part.text) {
                textResponse += part.text;
            }
        }
    }

    if (!generatedImageBase64) {
        const reason = candidate?.finishReason || 'UNKNOWN';
        const safetyRatings = candidate?.safetyRatings || [];
        
        let msg = `Model did not return an image. Finish Reason: ${reason}`;
        
        if (reason === 'SAFETY') {
             const unsafe = safetyRatings.filter(r => r.probability !== 'NEGLIGIBLE' && r.probability !== 'LOW');
             if (unsafe.length > 0) {
                 msg += `. Safety Flags: ${unsafe.map(r => `${r.category}=${r.probability}`).join(', ')}`;
             } else {
                 msg = "PROHIBITED_CONTENT: The model refused to generate this image due to safety guidelines.";
             }
        } else if (reason === 'PROHIBITED_CONTENT' || reason === 'IMAGE_SAFETY') {
             msg = `PROHIBITED_CONTENT: The model flagged the content as ${reason}. Try removing sensitive terms or reducing prompt complexity.`;
        }

        if (textResponse) msg += `. Message: ${textResponse.slice(0, 200)}`;

        const details = { 
            finishReason: reason,
            textResponse,
            safetyRatings,
            // Do NOT log the full 'response' object here as it may contain circular refs or be huge.
            // Only log safe, necessary parts.
            usage: response.usageMetadata
        };
        
        log('WARN', 'No image data in response', details); // Warn to avoid console spam
        throw new Error(msg);
    }

    // Return the data URL directly without re-encoding via canvas (which blocks UI)
    return `data:${outputMimeType};base64,${generatedImageBase64}`;

  } catch (error: any) {
    const formatted = formatErrorForLog(error);
    // Use WARN instead of ERROR for logic-handled errors to prevent browser console pollution
    // unless it's a critical system error
    log('WARN', 'Gemini API Error', formatted);
    throw ensureError(error);
  }
};

export const validateFileName = async (file: File | string, mimeTypeInput?: string): Promise<string> => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");
  
    const ai = new GoogleGenAI({ apiKey });
    
    let base64Image = '';
    let mimeType = mimeTypeInput || 'image/jpeg';
  
    if (file instanceof File) {
        base64Image = await fileToBase64(file);
        mimeType = file.type;
    } else {
        base64Image = file;
    }
  
    const prompt = `
      Analyze this image and create a short, descriptive filename for it.
      Rules:
      1. Max 5 words.
      2. Use only alphanumeric characters, dashes, and underscores.
      3. No file extension.
      4. Be specific about the subject matter (e.g., "elf-warrior-forest", "cyberpunk-street-night").
      5. STRICTLY FORBIDDEN: Do not include words like "line art", "lineart", "sketch", "drawing", "illustration", "image", "picture". 
      6. Output ONLY the filename.
    `;
  
    try {
        const response = await retryOperation<GenerateContentResponse>(() => 
          withTimeout(ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: {
                parts: [
                    { inlineData: { mimeType, data: base64Image } },
                    { text: prompt }
                ]
            },
            config: {
                responseMimeType: 'text/plain',
                safetySettings: SAFETY_SETTINGS
            }
        }), 30000, "Image Validation")
      );
  
        const text = response.text?.trim() || "untitled_image";
        // Clean up text
        let cleanName = text.replace(/[^a-zA-Z0-9-_]/g, '');
        // Safety replace for words we asked not to include, just in case
        cleanName = cleanName.replace(/line[-_\s]?art/gi, '').replace(/sketch/gi, '').replace(/drawing/gi, '');
        // Clean up double dashes or leading/trailing dashes resulting from removal
        cleanName = cleanName.replace(/[-_]{2,}/g, '-').replace(/^[-_]+|[-_]+$/g, '');
        
        return `_${cleanName.slice(0, 50)}` || "_processed_image";

    } catch (error) {
        log('WARN', 'Validation Request Error', formatErrorForLog(error));
        return "_processed_image";
    }
};

export const analyzeImage = async (file: File | string, mimeTypeInput?: string): Promise<ImageAnalysis> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key not found");

  const ai = new GoogleGenAI({ apiKey });
  
  let base64Image = '';
  let mimeType = mimeTypeInput || 'image/jpeg';

  if (file instanceof File) {
      base64Image = await fileToBase64(file);
      mimeType = file.type;
  } else {
      base64Image = file;
  }

  const prompt = `
    Analyze this image in detail.
    Output JSON only.
    Keys: title (max 5 words), description (max 50 words), objects (list 10 items), safety (summary).
  `;

  try {
      // Use retry for analysis as well
      const response = await retryOperation<GenerateContentResponse>(() => 
        withTimeout(ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
              parts: [
                  { inlineData: { mimeType, data: base64Image } },
                  { text: prompt }
              ]
          },
          config: {
              responseMimeType: 'application/json',
              responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                      title: { type: Type.STRING },
                      description: { type: Type.STRING },
                      objects: { type: Type.ARRAY, items: { type: Type.STRING } },
                      safety: { type: Type.STRING }
                  }
              },
              safetySettings: SAFETY_SETTINGS
          }
      }), 45000, "Image Analysis")
    );

      let jsonStr = response.text;
      if (!jsonStr) {
          throw new Error("Empty response text from analysis model");
      }
      
      // Sanitize JSON
      jsonStr = jsonStr.replace(/```json\n?|\n?```/g, '').trim();
      
      let data;
      try {
          data = JSON.parse(jsonStr);
      } catch (e) {
          log('WARN', 'JSON Parse Failed, using fallback', { textLength: jsonStr.length, errorMsg: getErrorMessage(e) });
          data = {
              title: "Analysis Incomplete",
              description: "The analysis data could not be fully parsed from the model response. Proceeding with defaults.",
              objects: [],
              safety: "Unknown"
          };
      }
      
      const title = data.title || "Untitled";
      const description = data.description || "No description provided.";
      const objects = Array.isArray(data.objects) ? data.objects : [];
      const safety = data.safety || "Unknown";

      const markdownContent = `
# ${title}

## Description
${description}

## Analysis
**Safety Assessment**: ${safety}

### Objects Detected
${objects.length > 0 ? objects.map((obj: string) => `- ${obj}`).join('\n') : 'No specific objects listed.'}

## Original Image
![Original Encoded Image](data:${mimeType};base64,${base64Image})
      `.trim();

      return {
          title,
          description,
          objects,
          safety,
          markdownContent
      };
  } catch (error) {
      log('WARN', 'Analysis Request Error', formatErrorForLog(error));
      throw ensureError(error);
  }
};