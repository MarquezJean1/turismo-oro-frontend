export type TurismoReview = {
  id: string;
  author: string;
  avatar: string;
  date: string;
  rating: number;
  comment: string;
};

export type TurismoPlace = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  direccion?: string;
  priceLabel: string;
  rating: number;
  reviewCount: number;
  distanceKm: number;
  description: string;
  photos: string[];
  reviews: TurismoReview[];
  highlights: string[];
};

export type CreatePlacePayload = {
  name: string;
  category: string;
  lat: number;
  lng: number;
  direccion: string;
  priceLabel: string;
  description: string;
  highlights: string[];
  images: File[];
};

export type CreateReviewPayload = {
  author: string;
  rating: number;
  comment: string;
};

/** Centro del mapa: Machala, El Oro, Ecuador */
export const TURISMO_MAP_CENTER = { lat: -3.266282, lng: -79.952801 };

export const DEFAULT_PHOTO =
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80";
