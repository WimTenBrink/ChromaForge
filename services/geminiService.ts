
import { GoogleGenAI, Schema, Type } from "@google/genai";
import { log } from "./logger";
import { ImageAnalysis } from "../types";

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

const convertToPng = (base64Data: string, inputMimeType: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error("Failed to convert image to PNG"));
    img.src = `data:${inputMimeType};base64,${base64Data}`;
  });
};

export const processImage = async (file: File | string, prompt: string, mimeTypeInput?: string): Promise<string> => {
  log('INFO', 'Initializing Gemini Request', { model: 'gemini-2.5-flash-image' });

  // API Key Check
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
      log('ERROR', 'API Key Missing', { message: 'process.env.API_KEY is undefined' });
      throw new Error("API Key not found. Please select a key.");
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

    const requestPayload = {
      model: 'gemini-2.5-flash-image',
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
      }
    };

    log('GEMINI_REQ', 'Sending Generate Content Request', { 
       model: requestPayload.model,
       promptLength: prompt.length,
       imageSize: base64Image.length
    });

    const response = await ai.models.generateContent(requestPayload);

    log('GEMINI_RES', 'Received Generate Content Response', { 
        candidates: response.candidates?.length,
        usage: response.usageMetadata
    });

    // Extract image
    let generatedImageBase64: string | null = null;
    let outputMimeType = 'image/jpeg'; 
    
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
        for (const part of parts) {
            if (part.inlineData) {
                generatedImageBase64 = part.inlineData.data;
                if (part.inlineData.mimeType) {
                    outputMimeType = part.inlineData.mimeType;
                }
                break;
            }
        }
    }

    if (!generatedImageBase64) {
        log('ERROR', 'No image data in response', response);
        throw new Error("Model did not return an image.");
    }

    // Convert the result to PNG (with alpha channel capability)
    const pngDataUrl = await convertToPng(generatedImageBase64, outputMimeType);
    return pngDataUrl;

  } catch (error: any) {
    log('ERROR', 'Gemini API Error', error);
    throw error;
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

      let jsonText = response.text || "{}";
      
      // Sanitize JSON (remove markdown code blocks if present)
      jsonText = jsonText.replace(/```json\n?|\n?```/g, '').trim();
      
      let data;
      try {
          data = JSON.parse(jsonText);
      } catch (e) {
          log('WARN', 'JSON Parse Failed, using fallback', { textLength: jsonText.length, error: (e as Error).message });
          // Fallback to prevent app crash
          data = {
              title: "Analysis Incomplete",
              description: "The analysis data could not be fully parsed from the model response. Proceeding with defaults.",
              objects: [],
              safety: "Unknown"
          };
      }
      
      // Provide defaults if fields are missing in valid JSON
      const title = data.title || "Untitled";
      const description = data.description || "No description provided.";
      const objects = Array.isArray(data.objects) ? data.objects : [];
      const safety = data.safety || "Unknown";

      // Generate Markdown content
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
      log('ERROR', 'Analysis Request Error', error);
      throw error;
  }
};
