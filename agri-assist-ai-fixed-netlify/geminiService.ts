import { GoogleGenAI, Modality, Type, Chat } from "@google/genai";
import { PestAnalysisResult, DailySummaryResult, SoilAnalysisResult } from '../types';

// Initialize Gemini AI. Assumes API_KEY is in process.env.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

/**
 * Utility to convert a File object to a base64 string.
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

/**
 * Analyzes a plant pest from an image and generates an audio summary.
 */
export const analyzePest = async (
  base64Image: string, 
  mimeType: string, 
  textPrompt: string,
  audioPromptTemplate: string,
): Promise<{ analysis: PestAnalysisResult | null, audioBase64: string | null }> => {
  try {
    const analysisResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType: mimeType } },
          { text: textPrompt }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            pest_or_disease_name: { type: Type.STRING },
            description: { type: Type.STRING },
            preventive_measures: { type: Type.ARRAY, items: { type: Type.STRING } },
            treatment_steps: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['pest_or_disease_name', 'description', 'preventive_measures', 'treatment_steps']
        },
      },
    });

    const jsonText = analysisResponse.text.trim();
    if (!jsonText) return { analysis: null, audioBase64: null };
    const analysisResult = JSON.parse(jsonText) as PestAnalysisResult;

    try {
        const audioPrompt = audioPromptTemplate
            .replace('{name}', analysisResult.pest_or_disease_name)
            .replace('{description}', analysisResult.description)
            .replace('{prevention}', analysisResult.preventive_measures.join('. '))
            .replace('{treatment}', analysisResult.treatment_steps.join('. '));
        
        const audioResponse = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: audioPrompt }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
              },
            },
        });
    
        const audioBase64 = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
        return { analysis: analysisResult, audioBase64 };
    } catch (e) {
        return { analysis: analysisResult, audioBase64: null };
    }
  } catch (error) {
    console.error("Error in analyzePest:", error);
    return { analysis: null, audioBase64: null };
  }
};

/**
 * Analyzes soil from an image and generates an audio summary.
 */
export const analyzeSoilByImage = async (
  base64Image: string,
  mimeType: string,
  textPrompt: string,
  audioPromptTemplate: string,
): Promise<{ analysis: SoilAnalysisResult | null, audioBase64: string | null }> => {
  try {
    const analysisResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Image, mimeType: mimeType } },
          { text: textPrompt }
        ]
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            soil_type: { type: Type.STRING },
            ph_level_estimate: { type: Type.STRING },
            nutrient_deficiencies: { type: Type.ARRAY, items: { type: Type.STRING } },
            recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['soil_type', 'ph_level_estimate', 'nutrient_deficiencies', 'recommendations']
        },
      },
    });

    const jsonText = analysisResponse.text.trim();
    if (!jsonText) return { analysis: null, audioBase64: null };
    const analysisResult = JSON.parse(jsonText) as SoilAnalysisResult;

    try {
      const audioPrompt = audioPromptTemplate
        .replace('{type}', analysisResult.soil_type)
        .replace('{ph}', analysisResult.ph_level_estimate)
        .replace('{deficiencies}', analysisResult.nutrient_deficiencies.join('. '))
        .replace('{recommendations}', analysisResult.recommendations.join('. '));

      const audioResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: audioPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
        },
      });

      const audioBase64 = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      return { analysis: analysisResult, audioBase64 };
    } catch (e) {
      return { analysis: analysisResult, audioBase64: null };
    }
  } catch (error) {
    console.error("Error in analyzeSoilByImage:", error);
    return { analysis: null, audioBase64: null };
  }
};

/**
 * Gets a daily agricultural summary based on location using Google Search for live data.
 */
export const getDailySummary = async (textPrompt: string, audioPromptTemplate: string): Promise<{ summary: DailySummaryResult | null, audioBase64: string | null }> => {
  try {
    const summaryResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: textPrompt,
      config: {
        tools: [{ googleSearch: {} }]
      },
    });

    const summaryText = summaryResponse.text;
    const sources = summaryResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    if (!summaryText) return { summary: null, audioBase64: null };

    const summaryResult: DailySummaryResult = {
      text: summaryText,
      sources: sources as any[]
    };

    try {
      // Create a simplified prompt for TTS since the main text might be long
      const audioPrompt = audioPromptTemplate.replace('{text}', summaryText.substring(0, 1000));
      
      const audioResponse = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-tts",
          contents: [{ parts: [{ text: audioPrompt }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
            },
          },
      });

      const audioBase64 = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
      return { summary: summaryResult, audioBase64 };
    } catch (e) {
      return { summary: summaryResult, audioBase64: null };
    }
  } catch (error) {
    console.error("Error in getDailySummary:", error);
    return { summary: null, audioBase64: null };
  }
};

/**
 * Creates a new Gemini chat session for the AI Agronomist.
 */
export const createAgronomistChat = (systemInstruction: string): Chat => {
    return ai.chats.create({
        model: 'gemini-3-pro-preview',
        config: {
            systemInstruction: systemInstruction,
            temperature: 0.2,
        },
    });
};