export interface PetInfo {
  id: string;
  name: string;
  species: 'dog' | 'cat';
  breed: string;
  age: string;
  weight: string;
  currentMedications?: string;
  vetName?: string;
  vetPhone?: string;
}

export type HistoryType = 'health' | 'vaccine' | 'dosage';

export interface HistoryItem {
  id: string;
  petId: string;
  type: HistoryType;
  date: string;
  query?: string; // For health advice (symptoms)
  content: string; // The AI response
}
