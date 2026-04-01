import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface VetLocation {
  name: string;
  address: string;
  phone?: string;
  rating?: string;
  mapsUrl: string;
}

export async function findNearbyVets(lat: number, lng: number): Promise<VetLocation[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Find the nearest veterinary clinics and their contact numbers near my current location.",
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude: lat,
              longitude: lng
            }
          }
        }
      },
    });

    const text = response.text || "";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    // Extract vet information from the text and grounding chunks
    // Since the text is markdown, we'll parse it simply or just rely on the grounding chunks for links
    const vets: VetLocation[] = [];
    
    chunks.forEach((chunk: any) => {
      if (chunk.maps) {
        vets.push({
          name: chunk.maps.title || "Veterinary Clinic",
          address: "", // Address might be in the text
          mapsUrl: chunk.maps.uri,
        });
      }
    });

    return vets;
  } catch (error) {
    console.error("Error finding nearby vets:", error);
    return [];
  }
}
