import { GoogleGenAI, Type } from "@google/genai";
import { log } from "./logger";
import { ImageAnalysis } from "../types";

// Helper to extract a readable message from any error type
const getErrorMessage = (err: any): string => {
  if (err === undefined || err === null) return "Unknown Error";
  if (typeof err === 'string') return err;
  
  if (err instanceof Error) return err.message;
  
  if (typeof err === 'object') {
      // Check for common API error patterns
      if (typeof err.message === 'string') return err.message;
      if (err.error && typeof err.error.message === 'string') return err.error.message; // Google API standard
      
      // If toString returns default object string, try JSON stringify
      if (typeof err.toString === 'function' && err.toString() !== '[object Object]') {
          return err.toString();
      }
      
      try {
          return JSON.stringify(err);
      } catch {
          return "Unknown Error Object (Non-serializable)";
      }
  }
  
  return String(err);
};

// Helper to ensure Error objects are serializable for logs
const formatErrorForLog = (err: any) => {
  const message = getErrorMessage(err);
  let stack = undefined;
  let raw = err;

  if (err instanceof Error) {
      stack = err.stack;
      // Capture extra properties on the error object
      raw = {};
      Object.getOwnPropertyNames(err).forEach(prop => {
          if (prop !== 'stack' && prop !== 'message') {
              (raw as any)[prop] = (err as any)[prop];
          }
      });
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
          }
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

    const response = await ai.models.generateContent(requestPayload);

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
        
        log('ERROR', 'No candidates in response', { response });
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
             }
        }

        if (textResponse) msg += `. Message: ${textResponse.slice(0, 200)}`;

        const details = { 
            finishReason: reason,
            textResponse,
            safetyRatings,
            rawResponse: response 
        };
        
        log('ERROR', 'No image data in response', details);
        throw new Error(msg);
    }

    // Return the data URL directly without re-encoding via canvas (which blocks UI)
    return `data:${outputMimeType};base64,${generatedImageBase64}`;

  } catch (error: any) {
    log('ERROR', 'Gemini API Error', formatErrorForLog(error));
    throw ensureError(error);
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
    Analyze this image in detail (simulating Google Cloud Vision).
    Provide the output in JSON format with the following keys:
    - title: A creative, short title for the image (max 5 words).
    - description: A concise description of the image content (max 100 words).
    - objects: A list of up to 20 prominent objects detected in the image.
    - safety: A safety assessment summary (Safe/Unsafe and why).
  `;

  try {
      const response = await ai.models.generateContent({
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
              }
          }
      });

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
          log('WARN', 'JSON Parse Failed, using fallback', { textLength: jsonStr.length, error: formatErrorForLog(e) });
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
      log('ERROR', 'Analysis Request Error', formatErrorForLog(error));
      throw ensureError(error);
  }
};