import "./turismo.page.css";
import {
  DEFAULT_PHOTO,
  TURISMO_MAP_CENTER,
  type CreatePlacePayload,
  type TurismoPlace,
  type TurismoReview,
} from "@/types/turismo.types";
import {
  agregarComentario,
  crearLugar,
  listarLugares,
  obtenerLugar,
} from "@/services/turismo.api";
import {
  actualizarColor,
  cerrarSesion,
  getStoredSession,
  iniciarSesion,
  obtenerColorTema,
  obtenerSesion,
  type AuthSession,
} from "@/services/auth.api";
import {
  AdvancedMarker,
  APIProvider,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import { ElOroProvinceBoundary } from "@/components/turismo-province-boundary";
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type FormEvent } from "react";

const DEFAULT_PRIMARY_COLOR = "#ff385c";

function darkenHex(hex: string, amount = 0.14): string {
  const normalized = hex.trim().replace("#", "");
  if (normalized.length !== 6) return hex;
  const num = parseInt(normalized, 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((num >> 16) & 0xff) * (1 - amount));
  const g = clamp(((num >> 8) & 0xff) * (1 - amount));
  const b = clamp((num & 0xff) * (1 - amount));
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const FILTER_OPTIONS = [
  "Todos",
  "Playas",
  "Naturaleza",
  "Puerto",
  "Historia",
] as const;

const CATEGORY_OPTIONS = [
  "Centro histórico",
  "Paseo costero",
  "Puerto y banano",
  "Playa e isla",
  "Playa",
  "Naturaleza",
  "Patrimonio natural",
  "Pueblo histórico",
] as const;

const MAX_IMAGENES = 4;

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

type MapCoords = { lat: number; lng: number };

function StarIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3-3" />
    </svg>
  );
}

function TurismoMapPin({
  place,
  isActive,
  disabled,
  onClick,
}: {
  place: TurismoPlace;
  isActive: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <AdvancedMarker
      position={{ lat: place.lat, lng: place.lng }}
      onClick={disabled ? undefined : onClick}
    >
      <div
        className={`turismo-map-pin${isActive ? " turismo-map-pin--active" : ""}${disabled ? " turismo-map-pin--disabled" : ""}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " ") onClick();
        }}
      >
        <span className="turismo-map-pin-label">{place.priceLabel}</span>
        <span className="turismo-map-pin-dot" />
      </div>
    </AdvancedMarker>
  );
}

function PendingPickMarker({ coords }: { coords: MapCoords }) {
  return (
    <AdvancedMarker position={coords}>
      <div className="turismo-map-pin turismo-map-pin--pending">
        <span className="turismo-map-pin-label">Nuevo punto</span>
        <span className="turismo-map-pin-dot" />
      </div>
    </AdvancedMarker>
  );
}

function MapPickPointHandler({
  active,
  onPick,
}: {
  active: boolean;
  onPick: (coords: MapCoords) => void;
}) {
  const map = useMap();
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    if (!map || !active) return;

    const listener = map.addListener("click", (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

      onPickRef.current({ lat, lng });
      map.panTo({ lat, lng });
      const zoom = map.getZoom();
      if (zoom == null || zoom < 13) map.setZoom(13);
    });

    return () => listener.remove();
  }, [active, map]);

  return null;
}

function PlaceCard({
  place,
  isSelected,
  isNew,
  onSelect,
  onHover,
}: {
  place: TurismoPlace;
  isSelected: boolean;
  isNew?: boolean;
  onSelect: () => void;
  onHover: (active: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={`turismo-card turismo-card--compact${isSelected ? " turismo-card--selected" : ""}`}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <div className="turismo-card-body">
        <div className="turismo-card-title-row">
          <h3 className="turismo-card-title">{place.name}</h3>
          <span className="turismo-card-rating">
            <StarIcon />
            {place.rating.toFixed(2)}
          </span>
        </div>
        <p className="turismo-card-meta">
          {place.category} · {place.distanceKm} km
        </p>
        <p className="turismo-card-meta">
          {place.reviewCount} reseñas · {place.priceLabel}
        </p>
        {isNew ? <span className="turismo-card-new-tag">Nuevo</span> : null}
      </div>
      <div className="turismo-card-image-wrap">
        <img src={place.photos[0] ?? DEFAULT_PHOTO} alt={place.name} loading="lazy" />
      </div>
    </button>
  );
}

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (rating: number) => void;
}) {
  return (
    <div className="turismo-star-picker" role="group" aria-label="Calificación">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={star <= value ? "is-active" : undefined}
          onClick={() => onChange(star)}
          aria-label={`${star} estrellas`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

type AddReviewFormProps = {
  onSubmit: (review: Omit<TurismoReview, "id" | "date" | "avatar">) => Promise<void>;
  isSubmitting?: boolean;
};

function AddReviewForm({ onSubmit, isSubmitting = false }: AddReviewFormProps) {
  const [author, setAuthor] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !comment.trim() || isSubmitting) return;

    setError(null);
    try {
      await onSubmit({ author: author.trim(), rating, comment: comment.trim() });
      setAuthor("");
      setRating(5);
      setComment("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo publicar el comentario.");
    }
  };

  return (
    <form className="turismo-review-form" onSubmit={handleSubmit}>
      <h4 className="turismo-review-form-title">Agregar comentario</h4>

      <div className="turismo-form-field">
        <label htmlFor="review-author">Tu nombre</label>
        <input
          id="review-author"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          placeholder="Ej. Juan Pérez"
          required
        />
      </div>

      <div className="turismo-form-field">
        <label>Calificación</label>
        <StarPicker value={rating} onChange={setRating} />
      </div>

      <div className="turismo-form-field">
        <label htmlFor="review-comment">Comentario</label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Cuéntanos tu experiencia..."
          required
        />
      </div>

      <div className="turismo-form-actions">
        <button
          type="submit"
          className="turismo-form-btn turismo-form-btn--primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Publicando..." : "Publicar comentario"}
        </button>
      </div>
      {error ? <p className="turismo-form-error">{error}</p> : null}
    </form>
  );
}

type AddPlaceModalProps = {
  open: boolean;
  coords: MapCoords | null;
  onClose: () => void;
  onChangeLocation: () => void;
  onSubmit: (payload: CreatePlacePayload) => Promise<void>;
};

function reverseGeocode(coords: MapCoords): Promise<string> {
  return new Promise((resolve) => {
    if (typeof google === "undefined" || !google.maps?.Geocoder) {
      resolve("Ubicación seleccionada en el mapa");
      return;
    }

    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location: coords }, (results, status) => {
      if (status === "OK" && results?.[0]?.formatted_address) {
        resolve(results[0].formatted_address);
        return;
      }
      resolve("Ubicación seleccionada en el mapa");
    });
  });
}

function AddPlaceModal({ open, coords, onClose, onChangeLocation, onSubmit }: AddPlaceModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<string>(CATEGORY_OPTIONS[0]);
  const [priceLabel, setPriceLabel] = useState("Gratis");
  const [description, setDescription] = useState("");
  const [highlights, setHighlights] = useState("");
  const [imagenes, setImagenes] = useState<File[]>([]);
  const [direccion, setDireccion] = useState("");
  const [resolviendoDireccion, setResolviendoDireccion] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setCategory(CATEGORY_OPTIONS[0]);
    setPriceLabel("Gratis");
    setDescription("");
    setHighlights("");
    setImagenes([]);
    setDireccion("");
    setError(null);
    setIsSubmitting(false);
  }, [open]);

  useEffect(() => {
    if (!open || !coords) return;

    let cancelled = false;
    setResolviendoDireccion(true);

    reverseGeocode(coords).then((address) => {
      if (!cancelled) {
        setDireccion(address);
        setResolviendoDireccion(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, coords]);

  if (!open || !coords) return null;

  const distanceKm = distanceKmFromCenter(coords.lat, coords.lng);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim() || isSubmitting) return;

    if (imagenes.length > MAX_IMAGENES) {
      setError(`Puedes subir como máximo ${MAX_IMAGENES} imágenes.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        name: name.trim(),
        category,
        lat: coords.lat,
        lng: coords.lng,
        direccion: direccion.trim() || "Ubicación seleccionada en el mapa",
        priceLabel: priceLabel.trim() || "Gratis",
        description: description.trim(),
        highlights: highlights
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        images: imagenes,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el lugar.");
      setIsSubmitting(false);
    }
  };

  const handleImagenesChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > MAX_IMAGENES) {
      setError(`Puedes subir como máximo ${MAX_IMAGENES} imágenes.`);
      setImagenes(files.slice(0, MAX_IMAGENES));
      return;
    }
    setError(null);
    setImagenes(files);
  };

  return (
    <div className="turismo-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="turismo-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-place-title"
      >
        <div className="turismo-modal-header">
          <h2 id="add-place-title">Agregar punto turístico</h2>
          <button type="button" className="turismo-modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <div className="turismo-picked-location">
          <div className="turismo-form-field">
            <label htmlFor="place-address">Ubicación en el mapa</label>
            <input
              id="place-address"
              value={resolviendoDireccion ? "Obteniendo dirección..." : direccion}
              disabled
              readOnly
            />
          </div>
          <span className="turismo-picked-location-distance">{distanceKm} km del centro</span>
          <button type="button" className="turismo-picked-location-change" onClick={onChangeLocation}>
            Cambiar punto
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="turismo-form-field">
            <label htmlFor="place-name">Nombre</label>
            <input
              id="place-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Mercado Municipal de Machala"
              required
            />
          </div>

          <div className="turismo-form-row">
            <div className="turismo-form-field">
              <label htmlFor="place-category">Categoría</label>
              <select
                id="place-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="turismo-form-field">
              <label htmlFor="place-price">Precio / entrada</label>
              <input
                id="place-price"
                value={priceLabel}
                onChange={(e) => setPriceLabel(e.target.value)}
                placeholder="Ej. Gratis"
              />
            </div>
          </div>

          <div className="turismo-form-field">
            <label htmlFor="place-description">Descripción</label>
            <textarea
              id="place-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe el lugar..."
              required
            />
          </div>

          <div className="turismo-form-field">
            <label htmlFor="place-photos">Fotos (opcional, máx. {MAX_IMAGENES})</label>
            <input
              id="place-photos"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              onChange={handleImagenesChange}
            />
            {imagenes.length > 0 ? (
              <p className="turismo-form-hint">{imagenes.length} imagen(es) seleccionada(s)</p>
            ) : null}
          </div>

          <div className="turismo-form-field">
            <label htmlFor="place-highlights">Destacados (separados por coma)</label>
            <input
              id="place-highlights"
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
              placeholder="Ej. Gastronomía, Artesanías, Familias"
            />
          </div>

          <div className="turismo-form-actions">
            <button type="button" className="turismo-form-btn" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button
              type="submit"
              className="turismo-form-btn turismo-form-btn--primary"
              disabled={isSubmitting || resolviendoDireccion}
            >
              {isSubmitting ? "Guardando..." : "Agregar lugar"}
            </button>
          </div>
          {error ? <p className="turismo-form-error">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}

type LoginModalProps = {
  open: boolean;
  onClose: () => void;
  onLogin: (usuario: string, password: string) => Promise<void>;
  isSubmitting?: boolean;
};

function LoginModal({ open, onClose, onLogin, isSubmitting = false }: LoginModalProps) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setUsuario("");
    setPassword("");
    setError(null);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!usuario.trim() || !password || isSubmitting) return;

    setError(null);
    try {
      await onLogin(usuario.trim(), password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    }
  };

  return (
    <div className="turismo-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="turismo-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-title"
      >
        <div className="turismo-modal-header">
          <h2 id="login-title">Iniciar sesión</h2>
          <button type="button" className="turismo-modal-close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="turismo-form-field">
            <label htmlFor="login-usuario">Usuario</label>
            <input
              id="login-usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="Ej. Elian1997"
              autoComplete="username"
              required
            />
          </div>

          <div className="turismo-form-field">
            <label htmlFor="login-password">Contraseña</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tu contraseña"
              autoComplete="current-password"
              required
            />
          </div>

          <div className="turismo-form-actions">
            <button type="button" className="turismo-form-btn" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button
              type="submit"
              className="turismo-form-btn turismo-form-btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Ingresando..." : "Ingresar"}
            </button>
          </div>
          {error ? <p className="turismo-form-error">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}

function PlaceDetail({
  place,
  onClose,
  onAddReview,
  isSubmittingReview,
}: {
  place: TurismoPlace;
  onClose: () => void;
  onAddReview: (review: Omit<TurismoReview, "id" | "date" | "avatar">) => Promise<void>;
  isSubmittingReview?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"descripcion" | "galeria" | "comentarios">("descripcion");
  const mainPhoto = place.photos[0] ?? DEFAULT_PHOTO;
  const allPhotos = place.photos.length > 0 ? place.photos : [DEFAULT_PHOTO];

  useEffect(() => {
    setActiveTab("descripcion");
  }, [place.id]);

  return (
    <section
      className="turismo-detail turismo-detail--panel"
      aria-label={`Detalle de ${place.name}`}
    >
      <div className="turismo-detail-hero">
        <img className="turismo-detail-hero-img" src={mainPhoto} alt={place.name} />
        <button
          type="button"
          className="turismo-detail-close"
          onClick={onClose}
          aria-label="Cerrar detalle"
        >
          ×
        </button>
      </div>

      <div className="turismo-detail-content">
        <div className="turismo-detail-header">
          <h2>{place.name}</h2>
        </div>

        <div className="turismo-detail-tabs" role="tablist" aria-label="Secciones del lugar">
          {(
            [
              { id: "descripcion", label: "Descripción" },
              { id: "galeria", label: "Galería" },
              { id: "comentarios", label: "Comentarios" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`turismo-detail-tab${activeTab === tab.id ? " turismo-detail-tab--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "descripcion" ? (
          <div className="turismo-detail-tab-panel" role="tabpanel">
            <div className="turismo-detail-meta">
              <span className="turismo-card-rating">
                <StarIcon />
                {place.reviewCount > 0 ? place.rating.toFixed(2) : "Sin reseñas"} · {place.reviewCount}{" "}
                reseñas
              </span>
              <span>{place.category}</span>
              <span>{place.direccion ?? `${place.distanceKm} km del centro`}</span>
              <span>{place.priceLabel}</span>
            </div>

            {place.highlights.length > 0 ? (
              <div className="turismo-highlights">
                {place.highlights.map((item) => (
                  <span key={item} className="turismo-highlight">
                    {item}
                  </span>
                ))}
              </div>
            ) : null}

            <p className="turismo-detail-desc">{place.description}</p>
          </div>
        ) : null}

        {activeTab === "galeria" ? (
          <div className="turismo-detail-tab-panel" role="tabpanel">
            <div className="turismo-gallery-grid">
              {allPhotos.map((photo, index) => (
                <img
                  key={`${photo}-${index}`}
                  src={photo}
                  alt={index === 0 ? place.name : `${place.name} foto ${index + 1}`}
                  loading="lazy"
                />
              ))}
            </div>
          </div>
        ) : null}

        {activeTab === "comentarios" ? (
          <div className="turismo-detail-tab-panel" role="tabpanel">
            {place.reviews.length === 0 ? (
              <p className="turismo-detail-empty">Aún no hay comentarios. Sé el primero.</p>
            ) : (
              place.reviews.map((review) => (
                <article key={review.id} className="turismo-review">
                  <img
                    className="turismo-review-avatar"
                    src={review.avatar}
                    alt={review.author}
                  />
                  <div>
                    <div className="turismo-review-head">
                      <span className="turismo-review-author">{review.author}</span>
                      <span className="turismo-card-rating">
                        <StarIcon />
                        {review.rating}
                      </span>
                      <span className="turismo-review-date">{review.date}</span>
                    </div>
                    <p className="turismo-review-text">{review.comment}</p>
                  </div>
                </article>
              ))
            )}

            <AddReviewForm onSubmit={onAddReview} isSubmitting={isSubmittingReview} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

export const TurismoPage = () => {
  const mapsKey = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;
  const mapId = import.meta.env.VITE_GOOGLE_MAP_ID as string | undefined;

  const [places, setPlaces] = useState<TurismoPlace[]>([]);
  const [userAddedIds, setUserAddedIds] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<(typeof FILTER_OPTIONS)[number]>("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [pickMode, setPickMode] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<MapCoords | null>(null);
  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [themeColor, setThemeColor] = useState(DEFAULT_PRIMARY_COLOR);

  const themeStyle = useMemo((): CSSProperties => {
    const primary = themeColor;
    return {
      "--turismo-primary": primary,
      "--turismo-primary-dark": darkenHex(primary),
    } as CSSProperties;
  }, [themeColor]);

  useEffect(() => {
    let cancelled = false;

    async function loadThemeColor() {
      try {
        const colorHex = await obtenerColorTema();
        if (!cancelled) setThemeColor(colorHex);
      } catch {
        // Mantiene el color por defecto.
      }
    }

    void loadThemeColor();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const stored = getStoredSession();
      if (!stored) {
        if (!cancelled) setIsRestoringSession(false);
        return;
      }

      try {
        const session = await obtenerSesion(stored.token);
        if (!cancelled) {
          setAuthSession(session);
          setThemeColor(session.colorHex);
        }
      } catch {
        cerrarSesion();
      } finally {
        if (!cancelled) setIsRestoringSession(false);
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPlaces() {
      setIsLoadingPlaces(true);
      setLoadError(null);
      try {
        const lugares = await listarLugares();
        if (cancelled) return;
        setPlaces(lugares);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "No se pudieron cargar los lugares.");
        }
      } finally {
        if (!cancelled) setIsLoadingPlaces(false);
      }
    }

    void loadPlaces();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;

    let cancelled = false;

    async function loadDetail() {
      setIsLoadingDetail(true);
      try {
        const detail = await obtenerLugar(selectedId!);
        if (cancelled) return;
        setPlaces((prev) => prev.map((p) => (p.id === detail.id ? detail : p)));
      } catch {
        // El listado sigue visible aunque falle el detalle.
      } finally {
        if (!cancelled) setIsLoadingDetail(false);
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const cancelPickFlow = useCallback(() => {
    setPickMode(false);
    setPendingCoords(null);
    setAddPlaceOpen(false);
  }, []);

  const handleStartPickMode = useCallback(() => {
    if (!mapsKey || !authSession) return;
    if (pickMode) {
      cancelPickFlow();
      return;
    }
    setPickMode(true);
    setPendingCoords(null);
    setAddPlaceOpen(false);
  }, [cancelPickFlow, mapsKey, pickMode, authSession]);

  const handleLogin = async (usuario: string, password: string) => {
    setIsLoggingIn(true);
    try {
      const session = await iniciarSesion(usuario, password);
      setAuthSession(session);
      setThemeColor(session.colorHex);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    cerrarSesion();
    setAuthSession(null);
    cancelPickFlow();
  };

  const handleColorChange = async (colorHex: string) => {
    if (!authSession) return;

    setAuthSession((prev) => (prev ? { ...prev, colorHex } : null));
    setThemeColor(colorHex);
    try {
      const saved = await actualizarColor(authSession.token, colorHex);
      setAuthSession((prev) => (prev ? { ...prev, colorHex: saved } : null));
      setThemeColor(saved);
    } catch {
      const stored = getStoredSession();
      if (stored) setAuthSession(stored);
    }
  };

  const handleMapPick = useCallback((coords: MapCoords) => {
    setPendingCoords(coords);
    setPickMode(false);
    setAddPlaceOpen(true);
  }, []);

  const handleChangeLocation = useCallback(() => {
    setAddPlaceOpen(false);
    setPendingCoords(null);
    setPickMode(true);
  }, []);

  const filteredPlaces = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return places.filter((place) => {
      const matchesSearch =
        !query ||
        place.name.toLowerCase().includes(query) ||
        place.category.toLowerCase().includes(query) ||
        place.description.toLowerCase().includes(query) ||
        (place.direccion?.toLowerCase().includes(query) ?? false);

      const matchesFilter =
        activeFilter === "Todos" ||
        (activeFilter === "Playas" &&
          (place.category.includes("Playa") || place.category.includes("isla"))) ||
        (activeFilter === "Naturaleza" &&
          (place.category.includes("Naturaleza") || place.category.includes("Patrimonio natural"))) ||
        (activeFilter === "Puerto" &&
          (place.category.includes("Puerto") || place.category.includes("costero"))) ||
        (activeFilter === "Historia" &&
          (place.category.includes("histórico") || place.category.includes("Patrimonio")));

      return matchesSearch && matchesFilter;
    });
  }, [activeFilter, places, searchQuery]);

  const selectedPlace = useMemo(
    () => places.find((p) => p.id === selectedId) ?? null,
    [places, selectedId],
  );

  const highlightedId = hoverId ?? selectedId;

  const handleSelectPlace = (id: string) => {
    setSelectedId(id);
  };

  const handleCloseDetail = () => {
    setSelectedId(null);
  };

  const handleAddPlace = async (payload: CreatePlacePayload) => {
    const created = await crearLugar(payload, authSession?.token);
    setPlaces((prev) => [created, ...prev]);
    setUserAddedIds((prev) => new Set(prev).add(created.id));
    setSelectedId(created.id);
    cancelPickFlow();
  };

  const handleAddReview = async (
    placeId: string,
    data: Omit<TurismoReview, "id" | "date" | "avatar">,
  ): Promise<void> => {
    setIsSubmittingReview(true);
    try {
      await agregarComentario(placeId, data);
      const detail = await obtenerLugar(placeId);
      setPlaces((prev) => prev.map((place) => (place.id === placeId ? detail : place)));
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="turismo-page" style={themeStyle}>
      <header className="turismo-header">
        <div className="turismo-brand">
          <span className="turismo-brand-icon">T</span>
          <span className="turismo-brand-text">Descubre El Oro</span>
        </div>

        <form
          className="turismo-search"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar lugares turísticos..."
            aria-label="Buscar lugares turísticos"
          />
          <button type="submit" className="turismo-search-btn" aria-label="Buscar">
            <SearchIcon />
          </button>
        </form>

        <div className="turismo-filters">
          {FILTER_OPTIONS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`turismo-filter-chip${activeFilter === filter ? " turismo-filter-chip--active" : ""}`}
              onClick={() => setActiveFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="turismo-header-auth">
          {authSession ? (
            <>
              <label className="turismo-color-picker" title="Personalizar color de botones">
                <span>Color</span>
                <input
                  type="color"
                  value={authSession.colorHex}
                  onChange={(e) => void handleColorChange(e.target.value)}
                  aria-label="Elegir color de botones"
                />
              </label>
              <span className="turismo-user-label">{authSession.usuario}</span>
              <button type="button" className="turismo-auth-btn" onClick={handleLogout}>
                Cerrar sesión
              </button>
            </>
          ) : (
            <button
              type="button"
              className="turismo-auth-btn turismo-auth-btn--primary"
              onClick={() => setLoginOpen(true)}
              disabled={isRestoringSession}
            >
              {isRestoringSession ? "..." : "Iniciar sesión"}
            </button>
          )}
        </div>
      </header>

      <div className="turismo-body">
        <div className="turismo-drawer">
          <div className="turismo-list-panel">
          <div className="turismo-list-header">
            <div className="turismo-list-header-row">
              <div>
                <h1>{filteredPlaces.length} lugares turísticos</h1>
                <p>Explora Machala y la provincia de El Oro</p>
              </div>
              {authSession ? (
                <button
                  type="button"
                  className={`turismo-add-btn${pickMode ? " turismo-add-btn--active" : ""}`}
                  onClick={handleStartPickMode}
                  disabled={!mapsKey}
                  title={!mapsKey ? "Se requiere Google Maps para agregar lugares" : undefined}
                >
                  {pickMode ? "Cancelar selección" : "+ Agregar lugar"}
                </button>
              ) : null}
            </div>
            {pickMode ? (
              <p className="turismo-pick-hint">
                Haz clic en el mapa para marcar el punto turístico.
              </p>
            ) : null}
            {!mapsKey ? (
              <p className="turismo-pick-hint turismo-pick-hint--warn">
                Configura <code>VITE_GOOGLE_MAPS_KEY</code> para agregar lugares desde el mapa.
              </p>
            ) : null}
          </div>

          {loadError ? (
            <p className="turismo-pick-hint turismo-pick-hint--warn">{loadError}</p>
          ) : null}

          {isLoadingPlaces ? (
            <p style={{ color: "#717171", marginTop: 24 }}>Cargando lugares turísticos...</p>
          ) : null}

          <div className="turismo-grid">
            {filteredPlaces.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                isSelected={selectedId === place.id}
                isNew={userAddedIds.has(place.id)}
                onSelect={() => handleSelectPlace(place.id)}
                onHover={(active) => setHoverId(active ? place.id : null)}
              />
            ))}
          </div>

          {filteredPlaces.length === 0 && !isLoadingPlaces ? (
            <p style={{ color: "#717171", marginTop: 24 }}>
              {places.length === 0
                ? "Aún no hay lugares registrados. ¡Sé el primero en agregar uno!"
                : "No hay lugares que coincidan con tu búsqueda."}
            </p>
          ) : null}
          </div>
        </div>

        {selectedPlace && filteredPlaces.some((p) => p.id === selectedPlace.id) ? (
          <div className="turismo-detail-panel">
            <PlaceDetail
              place={selectedPlace}
              onClose={handleCloseDetail}
              onAddReview={(review) => handleAddReview(selectedPlace.id, review)}
              isSubmittingReview={isSubmittingReview || isLoadingDetail}
            />
          </div>
        ) : null}

        <aside className={`turismo-map-panel${pickMode ? " turismo-map-panel--picking" : ""}`}>
          {!mapsKey ? (
            <div className="turismo-map-empty">
              <p>
                Configura <code>VITE_GOOGLE_MAPS_KEY</code> para ver el mapa interactivo.
              </p>
            </div>
          ) : (
            <>
              {pickMode ? (
                <div className="turismo-map-pick-banner">
                  Selecciona un punto en el mapa
                </div>
              ) : null}
              <APIProvider apiKey={mapsKey}>
                <Map
                  className="turismo-map-root"
                  defaultCenter={TURISMO_MAP_CENTER}
                  defaultZoom={10}
                  mapId={mapId}
                  gestureHandling="greedy"
                  disableDefaultUI={false}
                  fullscreenControl
                  zoomControl
                >
                  <ElOroProvinceBoundary />
                  <MapPickPointHandler active={pickMode} onPick={handleMapPick} />
                  {pendingCoords ? <PendingPickMarker coords={pendingCoords} /> : null}
                  {filteredPlaces.map((place) => (
                    <TurismoMapPin
                      key={place.id}
                      place={place}
                      isActive={highlightedId === place.id}
                      disabled={pickMode}
                      onClick={() => handleSelectPlace(place.id)}
                    />
                  ))}
                </Map>
              </APIProvider>
            </>
          )}
        </aside>
      </div>

      <AddPlaceModal
        open={addPlaceOpen}
        coords={pendingCoords}
        onClose={cancelPickFlow}
        onChangeLocation={handleChangeLocation}
        onSubmit={handleAddPlace}
      />

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLogin={handleLogin}
        isSubmitting={isLoggingIn}
      />
    </div>
  );
};
