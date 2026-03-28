import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geocodeAddress } from '../api/client';

// Evita iconos por defecto rotos en bundlers
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

type LatLng = [number, number];

// Marcadores personalizados: verde = entrega, rojo = recolección
function createColoredIcon(color: string, label: string) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:bold;">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}
const iconEntrega = createColoredIcon('#16a34a', 'E');   // verde
const iconRecoleccion = createColoredIcon('#dc2626', 'R'); // rojo

async function fetchRoute(from: LatLng, to: LatLng): Promise<LatLng[] | null> {
  try {
    const coords = `${from[1]},${from[0]};${to[1]},${to[0]}`;
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
    );
    const data = await res.json();
    if (data?.routes?.[0]?.geometry?.coordinates) {
      return data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as LatLng);
    }
  } catch {
    // ignore
  }
  return null;
}

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(points as [LatLng, LatLng], { padding: [40, 40], maxZoom: 12 });
    } else if (points.length === 1) {
      map.setView(points[0], 14);
    }
  }, [map, points]);
  return null;
}

type MapRouteProps = {
  ubicacionEntrega?: string;
  ubicacionRecoleccion?: string;
  className?: string;
  /** Si es false, no se muestra la barra de título interna (útil cuando el padre ya pone el encabezado). */
  showHeading?: boolean;
};

export function MapRoute({
  ubicacionEntrega,
  ubicacionRecoleccion,
  className = '',
  showHeading = true,
}: MapRouteProps) {
  const [entrega, setEntrega] = useState<LatLng | null>(null);
  const [recoleccion, setRecoleccion] = useState<LatLng | null>(null);
  const [ruta, setRuta] = useState<LatLng[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEntrega(null);
    setRecoleccion(null);
    setRuta(null);

    const run = async () => {
      const hasEntrega = !!ubicacionEntrega?.trim();
      const hasRecoleccion = !!ubicacionRecoleccion?.trim();
      if (!hasEntrega && !hasRecoleccion) {
        setLoading(false);
        return;
      }

      try {
        let e: LatLng | null = null;
        let r: LatLng | null = null;
        if (hasEntrega) {
          e = await geocodeAddress(ubicacionEntrega!);
          if (cancelled) return;
        }
        if (hasEntrega && hasRecoleccion) {
          await new Promise((resolve) => setTimeout(resolve, 1100));
          if (cancelled) return;
        }
        if (hasRecoleccion) {
          r = await geocodeAddress(ubicacionRecoleccion!);
          if (cancelled) return;
        }

        setEntrega(e);
        setRecoleccion(r);

        if (!e && !r) {
          if (hasEntrega || hasRecoleccion) {
            setError('No se encontraron las direcciones en el mapa. Revisa el texto o intenta más tarde.');
          }
        }

        if (e && r) {
          const route = await fetchRoute(e, r);
          if (cancelled) return;
          setRuta(route);
        }
      } catch {
        if (!cancelled) setError('No se pudo cargar el mapa');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [ubicacionEntrega, ubicacionRecoleccion]);

  const points: LatLng[] = [];
  if (entrega) points.push(entrega);
  if (recoleccion) points.push(recoleccion);

  if (!ubicacionEntrega?.trim() && !ubicacionRecoleccion?.trim()) {
    return null;
  }

  const center: LatLng = points[0] ?? [19.4326, -99.1332]; // CDMX por defecto

  return (
    <div className={`overflow-hidden rounded-lg border border-skyline-border [&_.custom-marker]:!border-0 [&_.custom-marker]:!bg-transparent ${className}`}>
      {showHeading && (
        <h3 className="border-b border-skyline-border bg-skyline-bg px-4 py-2 text-sm font-semibold text-gray-700">
          Mapa · Ruta de entrega
        </h3>
      )}
      <div className="relative h-64 min-h-[256px] w-full">
        {loading && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/80">
            <span className="text-sm text-gray-500">Cargando mapa...</span>
          </div>
        )}
        {error && !loading && (
          <div className="flex h-full items-center justify-center bg-gray-50 text-sm text-amber-700">
            {error}
          </div>
        )}
        {!error && (
          <MapContainer
            center={center}
            zoom={points.length >= 2 ? 10 : 14}
            className="h-full w-full"
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {points.length > 0 && <FitBounds points={points} />}
            {entrega && (
              <Marker position={entrega} icon={iconEntrega}>
                <Popup>Entrega: {ubicacionEntrega}</Popup>
              </Marker>
            )}
            {recoleccion && (
              <Marker position={recoleccion} icon={iconRecoleccion}>
                <Popup>Recolección: {ubicacionRecoleccion}</Popup>
              </Marker>
            )}
            {ruta && ruta.length > 0 && (
              <Polyline
                positions={ruta}
                pathOptions={{ color: '#2D58A7', weight: 4, opacity: 0.8 }}
              />
            )}
          </MapContainer>
        )}
      </div>
      {(ubicacionEntrega || ubicacionRecoleccion) && (
        <div className="border-t border-skyline-border bg-gray-50 px-4 py-2 text-xs text-gray-600">
          <a
            href={`https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(ubicacionRecoleccion || '')}&destination=${encodeURIComponent(ubicacionEntrega || '')}`}
            target="_blank"
            rel="noreferrer"
            className="text-skyline-blue hover:underline"
          >
            Abrir en Google Maps →
          </a>
        </div>
      )}
    </div>
  );
}
