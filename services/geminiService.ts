import { GoogleGenAI, Type, GenerateContentResponse, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { log } from "./logger";
import { ImageAnalysis } from "../types";

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

export const processImage = async (file: File | string, prompt: string, mimeTypeInput?: string, aspectRatio?: string): Promise<string> => {
  log('INFO', 'Initializing Gemini Request', { model: 'gemini-3-pro-image-preview', aspectRatio });

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
              imageSize: '4K',
          },
          // Set all safety thresholds to BLOCK_NONE to be as tolerant as possible
          safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_CIVIC_INTEGRITY, threshold: HarmBlockThreshold.BLOCK_NONE },
          ]
      }
    };

    // Configure Aspect Ratio if specified and not 'Original'
    const supportedRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
    if (aspectRatio && aspectRatio !== 'Original' && supportedRatios.includes(aspectRatio)) {
        requestPayload.config.imageConfig.aspectRatio = aspectRatio;
    } else if (aspectRatio && aspectRatio !== 'Original') {
         // Log warning for unsupported ratio, the prompt text will attempt to handle it
         log('WARN', 'Unsupported Aspect Ratio config for this model, relying on prompt text', { aspectRatio });
    }

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
    let outputMimeType = 'image/jpeg'; 
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
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                ]
            }
        }), 30000, "Image Validation")
      );
  
        const text = response.text?.trim() || "untitled_image";
        // Clean up text
        const cleanName = text.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 50);
        return cleanName || "image";

    } catch (error) {
        log('WARN', 'Validation Request Error', formatErrorForLog(error));
        return "processed_image";
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
              safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            ]
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