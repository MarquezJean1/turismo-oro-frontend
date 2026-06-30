import {
  DEFAULT_PHOTO,
  TURISMO_MAP_CENTER,
  type CreatePlacePayload,
  type CreateReviewPayload,
  type TurismoPlace,
  type TurismoReview,
} from "@/types/turismo.types";

function resolveApiBase(): string {
  const env = (import.meta.env.VITE_ENV as string | undefined)?.toLowerCase() ?? "local";
  const url =
    env === "prod"
      ? (import.meta.env.VITE_API_URL_PROD as string | undefined)
      : (import.meta.env.VITE_API_URL_LOCAL as string | undefined);

  return (url ?? "").replace(/\/$/, "");
}

const API_BASE = resolveApiBase();

type ApiTurismoListItem = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  priceLabel: string;
  photo?: string | null;
  rating: number;
  reviewCount: number;
};

type ApiTurismoDetail = ApiTurismoListItem & {
  direccion?: string;
  description: string;
  highlights: string[];
  photos: string[];
  reviews: Array<{
    id: string;
    author: string;
    rating: number;
    comment: string;
    date: string;
  }>;
};

type ApiError = { mensaje?: string; message?: string };

function distanceKmFromCenter(lat: number, lng: number) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat - TURISMO_MAP_CENTER.lat);
  const dLng = toRad(lng - TURISMO_MAP_CENTER.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(TURISMO_MAP_CENTER.lat)) *
      Math.cos(toRad(lat)) *
      Math.sin(dLng / 2) ** 2;
  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

export function resolvePhotoUrl(url: string): string {
  if (!url) return DEFAULT_PHOTO;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE}${url.startsWith("/") ? url : `/${url}`}`;
}

function mapReview(review: ApiTurismoDetail["reviews"][number]): TurismoReview {
  return {
    id: review.id,
    author: review.author,
    rating: review.rating,
    comment: review.comment,
    date: review.date,
    avatar: `https://i.pravatar.cc/64?u=${encodeURIComponent(review.author)}`,
  };
}

function mapListItem(item: ApiTurismoListItem): TurismoPlace {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    lat: Number(item.lat),
    lng: Number(item.lng),
    priceLabel: item.priceLabel,
    rating: item.rating,
    reviewCount: item.reviewCount,
    distanceKm: distanceKmFromCenter(Number(item.lat), Number(item.lng)),
    description: "",
    photos: item.photo ? [resolvePhotoUrl(item.photo)] : [DEFAULT_PHOTO],
    highlights: [],
    reviews: [],
  };
}

function mapDetail(item: ApiTurismoDetail): TurismoPlace {
  const photos = item.photos?.length
    ? item.photos.map(resolvePhotoUrl)
    : item.photo
      ? [resolvePhotoUrl(item.photo)]
      : [DEFAULT_PHOTO];

  return {
    id: item.id,
    name: item.name,
    category: item.category,
    lat: Number(item.lat),
    lng: Number(item.lng),
    direccion: item.direccion,
    priceLabel: item.priceLabel,
    rating: item.rating,
    reviewCount: item.reviewCount,
    distanceKm: distanceKmFromCenter(Number(item.lat), Number(item.lng)),
    description: item.description,
    photos,
    highlights: item.highlights ?? [],
    reviews: (item.reviews ?? []).map(mapReview),
  };
}

async function parseError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as ApiError;
    return data.mensaje ?? data.message ?? `Error ${response.status}`;
  } catch {
    return `Error ${response.status}`;
  }
}

export async function listarLugares(busqueda?: string, categoria?: string): Promise<TurismoPlace[]> {
  const params = new URLSearchParams();
  if (busqueda?.trim()) params.set("busqueda", busqueda.trim());
  if (categoria?.trim()) params.set("categoria", categoria.trim());

  const query = params.toString();
  const response = await fetch(`${API_BASE}/api/turismo${query ? `?${query}` : ""}`);

  if (!response.ok) throw new Error(await parseError(response));

  const data = (await response.json()) as ApiTurismoListItem[];
  return data.map(mapListItem);
}

export async function obtenerLugar(id: string): Promise<TurismoPlace> {
  const response = await fetch(`${API_BASE}/api/turismo/${id}`);

  if (!response.ok) throw new Error(await parseError(response));

  const data = (await response.json()) as ApiTurismoDetail;
  return mapDetail(data);
}

export async function crearLugar(payload: CreatePlacePayload): Promise<TurismoPlace> {
  const form = new FormData();
  form.append("Nombre", payload.name);
  form.append("Categoria", payload.category);
  form.append("Latitud", String(payload.lat));
  form.append("Longitud", String(payload.lng));
  form.append("Direccion", payload.direccion);
  form.append("EtiquetaPrecio", payload.priceLabel);
  form.append("Descripcion", payload.description);
  form.append("Destacados", payload.highlights.join(", "));

  for (const imagen of payload.images) {
    form.append("Imagenes", imagen);
  }

  const response = await fetch(`${API_BASE}/api/turismo`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) throw new Error(await parseError(response));

  const data = (await response.json()) as ApiTurismoDetail;
  return mapDetail(data);
}

export async function agregarComentario(
  lugarId: string,
  payload: CreateReviewPayload,
): Promise<TurismoReview> {
  const response = await fetch(`${API_BASE}/api/turismo/${lugarId}/comentarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      author: payload.author,
      rating: payload.rating,
      comment: payload.comment,
    }),
  });

  if (!response.ok) throw new Error(await parseError(response));

  const data = (await response.json()) as ApiTurismoDetail["reviews"][number];
  return mapReview(data);
}

export { API_BASE };
