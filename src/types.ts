export interface Location {
  address: string;
  placeId: string;
  lat: number;
  lng: number;
}

export interface LightLog {
  id?: string;
  userId: string;
  userName: string;
  status: 'on' | 'off';
  location: Location;
  timestamp: any; // Firestore serverTimestamp
}

export interface UserProfile {
  displayName: string;
  email: string;
  lastLocation?: {
    address: string;
    placeId: string;
    lat: number;
    lng: number;
  };
}

export interface PredictionResult {
  prediction: string;
  confidence: number;
  estimatedTime?: string;
}
