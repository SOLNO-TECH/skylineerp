import { useState, useCallback, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { geocodeAddress, reverseGeocodeCoords } from '../api/client';

export type LatLng = [number, number];

// Marcadores: verde = entrega, rojo = recolección
function createColoredIcon(color: string, label: string) {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background:${color};width:26px;height:26px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:bold;">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}
const iconEntrega = createColoredIcon('#16a34a', 'E');
const iconRecoleccion = createColoredIcon('#dc2626', 'R');

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

type MapPickerProps = {
  ubicacionEntrega: string;
  ubicacionRecoleccion: string;
  onEntregaChange: (v: string) => void;
  onRecoleccionChange: (v: string) => void;
  className?: string;
};

export function MapPicker({
  ubicacionEntrega,
  ubicacionRecoleccion,
  onEntregaChange,
  onRecoleccionChange,
  className = '',
}: MapPickerProps) {
  const [modo, setModo] = useState<'entrega' | 'recoleccion'>('entrega');
  const [entrega, setEntrega] = useState<LatLng | null>(null);
  const [recoleccion, setRecoleccion] = useState<LatLng | null>(null);
  const [ruta, setRuta] = useState<LatLng[] | null>(null);
  const [geocoding, setGeocoding] = useState<'entrega' | 'recoleccion' | null>(null);
  const lastAddresses = useRef({ entrega: '', recoleccion: '' });

  // Sincronizar coordenadas desde direcciones (geocodificar)
  const syncFromAddresses = useCallback(async () => {
    const hasE = !!ubicacionEntrega?.trim();
    const hasR = !!ubicacionRecoleccion?.trim();
    if (!hasE && !hasR) {
      setEntrega(null);
      setRecoleccion(null);
      setRuta(null);
      return;
    }
    if (
      lastAddresses.current.entrega === ubicacionEntrega &&
      lastAddresses.current.recoleccion === ubicacionRecoleccion
    ) {
      return;
    }
    lastAddresses.current = { entrega: ubicacionEntrega, recoleccion: ubicacionRecoleccion };

    let e: LatLng | null = null;
    let r: LatLng | null = null;
    try {
      if (hasE) e = await geocodeAddress(ubicacionEntrega!);
      if (hasE && hasR) await new Promise((res) => setTimeout(res, 1100));
      if (hasR) r = await geocodeAddress(ubicacionRecoleccion!);
    } catch {
      e = null;
      r = null;
    }
    setEntrega(e || null);
    setRecoleccion(r || null);
    if (e && r) {
      const route = await fetchRoute(e, r);
      setRuta(route);
    } else {
      setRuta(null);
    }
  }, [ubicacionEntrega, ubicacionRecoleccion]);

  // Sincronizar al montar si ya hay direcciones (ej. modo edición)
  useEffect(() => {
    if (ubicacionEntrega?.trim() || ubicacionRecoleccion?.trim()) {
      lastAddresses.current = { entrega: '', recoleccion: '' };
      syncFromAddresses();
    }
  }, []);

  const handleBuscarEnMapa = () => {
    setGeocoding('entrega');
    syncFromAddresses().finally(() => setGeocoding(null));
  };

  const points: LatLng[] = [];
  if (entrega) points.push(entrega);
  if (recoleccion) points.push(recoleccion);
  const center: LatLng = points[0] ?? [19.4326, -99.1332];

  function FitBounds({ pts }: { pts: LatLng[] }) {
    const map = useMap();
    const key = pts.map((p) => p.join(',')).join('|');
    useEffect(() => {
      if (pts.length >= 2) {
        map.fitBounds(pts as [LatLng, LatLng], { padding: [20, 20], maxZoom: 14 });
      } else if (pts.length === 1) {
        map.setView(pts[0], 14);
      }
    }, [map, key]);
    return null;
  }

  function MapClickHandler() {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        const coord: LatLng = [lat, lng];
        setGeocoding(modo);
        reverseGeocodeCoords(lat, lng)
          .then((addr) => {
            const text = addr || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            if (modo === 'entrega') {
              setEntrega(coord);
              onEntregaChange(text);
              lastAddresses.current.entrega = text;
              if (recoleccion) {
                fetchRoute(coord, recoleccion).then(setRuta);
              } else {
                setRuta(null);
              }
            } else {
              setRecoleccion(coord);
              onRecoleccionChange(text);
              lastAddresses.current.recoleccion = text;
              if (entrega) {
                fetchRoute(entrega, coord).then(setRuta);
              } else {
                setRuta(null);
              }
            }
          })
          .catch(() => {
            const text = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
            if (modo === 'entrega') {
              setEntrega(coord);
              onEntregaChange(text);
            } else {
              setRecoleccion(coord);
              onRecoleccionChange(text);
            }
          })
          .finally(() => setGeocoding(null));
      },
    });
    return null;
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border border-skyline-border [&_.custom-marker]:!border-0 [&_.custom-marker]:!bg-transparent ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-skyline-border bg-skyline-bg px-3 py-2">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setModo('entrega')}
            className={`rounded px-2 py-1 text-xs font-medium transition ${
              modo === 'entrega' ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Marcar entrega
          </button>
          <button
            type="button"
            onClick={() => setModo('recoleccion')}
            className={`rounded px-2 py-1 text-xs font-medium transition ${
              modo === 'recoleccion' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            Marcar recolección
          </button>
        </div>
        <button
          type="button"
          onClick={handleBuscarEnMapa}
          disabled={geocoding !== null || (!ubicacionEntrega?.trim() && !ubicacionRecoleccion?.trim())}
          className="text-xs text-skyline-blue hover:underline disabled:opacity-50"
        >
          {geocoding ? 'Buscando...' : 'Buscar direcciones en mapa'}
        </button>
      </div>
      <p className="border-b border-skyline-border bg-amber-50/50 px-3 py-1.5 text-xs text-amber-800">
        Haz clic en el mapa para colocar el punto de {modo === 'entrega' ? 'entrega (verde)' : 'recolección (rojo)'}
      </p>
      <div className="relative h-48 w-full">
        <MapContainer
          center={center}
          zoom={points.length >= 2 ? 10 : 13}
          className="h-full w-full cursor-crosshair"
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {points.length > 0 && <FitBounds pts={points} />}
          <MapClickHandler />
          {entrega && <Marker position={entrega} icon={iconEntrega} />}
          {recoleccion && <Marker position={recoleccion} icon={iconRecoleccion} />}
          {ruta && ruta.length > 0 && (
            <Polyline positions={ruta} pathOptions={{ color: '#2D58A7', weight: 4, opacity: 0.8 }} />
          )}
        </MapContainer>
        {geocoding && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/70">
            <span className="text-sm text-gray-600">Obteniendo dirección...</span>
          </div>
        )}
      </div>
    </div>
  );
}
