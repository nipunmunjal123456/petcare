import { GoogleGenAI } from "@google/genai";
import { PetInfo } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getHealthAdvice(pet: PetInfo, symptoms: string) {
  const model = "gemini-3-flash-preview";
  const prompt = `
    You are an expert veterinarian assistant. 
    Pet Profile:
    - Name: ${pet.name}
    - Species: ${pet.species}
    - Breed: ${pet.breed}
    - Age: ${pet.age}
    - Weight: ${pet.weight}
    - Current Medications: ${pet.currentMedications || 'None'}

    User Symptoms/Query: ${symptoms}

    Please provide:
    1. A potential diagnosis (with a strong disclaimer that you are an AI).
    2. Recommended over-the-counter medicines (if applicable) or treatments.
    3. Potential interactions between the current medications (${pet.currentMedications || 'None'}) and any new recommendations or the current symptoms.
    4. Recommended vaccines if they are missing any based on their age.
    5. When to see a vet immediately.

    Format the response in clear Markdown.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: "You are a professional veterinarian assistant. Always include a disclaimer that your advice is for informational purposes only and a real vet should be consulted for serious issues. Be empathetic and clear.",
    }
  });

  return response.text;
}

export async function getVaccineSchedule(species: 'dog' | 'cat', age: string) {
  const model = "gemini-3-flash-preview";
  const prompt = `
    Provide a standard vaccination schedule for a ${species} that is ${age} old.
    Include core and non-core vaccines.
    Format as a Markdown table.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
  });

  return response.text;
}

export async function getDosageAdvice(pet: PetInfo, medication: string, dosage: string) {
  const model = "gemini-3-flash-preview";
  const prompt = `
    You are an expert veterinarian assistant. 
    Pet Profile:
    - Species: ${pet.species}
    - Breed: ${pet.breed}
    - Age: ${pet.age}
    - Weight: ${pet.weight}

    User Query:
    - Medication: ${medication}
    - Proposed Dosage: ${dosage}

    Please provide:
    1. An assessment of whether this dosage is typically appropriate for a pet of this species and weight.
    2. Common side effects to watch for.
    3. A CRITICAL warning that dosage should always be confirmed by a licensed veterinarian.
    4. Signs of overdose for this specific medication.

    Format the response in clear Markdown.
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: "You are a professional veterinarian assistant. Dosage advice is extremely sensitive. Always emphasize that the user MUST consult their vet before administering any medication. Be precise but cautious.",
    }
  });

  return response.text;
}
