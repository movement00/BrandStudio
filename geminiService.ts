
import { GoogleGenAI, Type } from "@google/genai";
import { OptimizedPromptDetails } from "./types";

const PROMPT_GENERATOR_SYSTEM_INSTRUCTION = `
Sen, Pixar Stüdyoları'nda çalışan bir Görsel Senaryo Tasarımcısısın. Görevin, verilen hikaye metnini ve **ekli referans görseldeki karakteri** kullanarak Nano Banana Pro modeli için teknik bir 3D çizim direktifi (prompt) hazırlamaktır.

TEMEL PRENSİPLER:
1. Karakter Kimliği: Karakterin fiziksel özelliklerini betimleme. "Referans görseldeki kişi/karakter" (the character from the provided reference image) olarak hitap et. Nano Banana Pro'nun bu yüzü ve kimliği Pixar tarzında (3D stylized) sahneye aktarmasını sağla.
2. Sahne Akışı: Hikaye metnindeki duyguyu (heyecan, merak, hüzün, zafer) görsele yansıt.
3. Stil: 3D Disney/Pixar animasyon estetiği. Yumuşak ışıklandırma, canlı renk paleti, yüksek kaliteli dokular.
4. Çıktı Formatı: Mutlaka JSON.

JSON Yapısı:
- characterAnalysis: Referans görseldeki karakterin Pixar dünyasına nasıl adapte edileceği (yüz ifadesi, duruşu).
- environmentDetails: Sahnenin geçtiği mekanın (park, salon, büyülü ışıklar) detaylı betimlemesi.
- lightingAndColor: Sahneye uygun sinematik ışık ve renk şeması.
- perspective: Kamera açısı ve lens derinliği.
- optimizedPrompt: Nano Banana Pro'ya gönderilecek nihai İngilizce teknik prompt. Referans görsele mutlaka atıf yapmalı.
`;

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async generateOptimizedPrompt(sceneDescription: string, characterName?: string, referenceImageBase64?: string): Promise<OptimizedPromptDetails> {
    const parts: any[] = [
      { text: `Hikaye Sahnesi: ${sceneDescription}${characterName ? ` (Karakter Adı: ${characterName})` : ''}` }
    ];

    if (referenceImageBase64) {
      const base64Data = referenceImageBase64.split(',')[1] || referenceImageBase64;
      parts.unshift({
        inlineData: {
          data: base64Data,
          mimeType: 'image/png'
        }
      });
      parts.push({ text: "Görseldeki kişinin yüzünü ve kimliğini 3D Pixar karakteri olarak koru ve sahneye yerleştir." });
    }

    const response = await this.ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts },
      config: {
        systemInstruction: PROMPT_GENERATOR_SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            characterAnalysis: { type: Type.STRING },
            environmentDetails: { type: Type.STRING },
            lightingAndColor: { type: Type.STRING },
            perspective: { type: Type.STRING },
            optimizedPrompt: { type: Type.STRING }
          },
          required: ["characterAnalysis", "environmentDetails", "lightingAndColor", "perspective", "optimizedPrompt"]
        }
      },
    });

    return JSON.parse(response.text || '{}') as OptimizedPromptDetails;
  }

  async generateImage(prompt: string, referenceImageBase64?: string): Promise<string> {
    const parts: any[] = [{ text: prompt }];

    if (referenceImageBase64) {
      const base64Data = referenceImageBase64.split(',')[1] || referenceImageBase64;
      parts.unshift({
        inlineData: {
          data: base64Data,
          mimeType: 'image/png'
        }
      });
    }

    const response = await this.ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "3:4"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    throw new Error("Görsel oluşturulamadı.");
  }
}
