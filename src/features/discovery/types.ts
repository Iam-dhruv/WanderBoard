export interface Place {
  name: string;
  rating: number;
  address: string;
  photoUrl: string;
  placeId: string;
  types?: string[];
  location?: {
    lat: number;
    lng: number;
  };
}
