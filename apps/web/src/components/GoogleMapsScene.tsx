import { useEffect, useRef, useState } from 'react';
import './google-maps-scene.css';

type GoogleMapsApi = {
  maps: {
    Map: new (element: HTMLElement, options: {
      center: { lat: number; lng: number };
      zoom: number;
      mapTypeControl: boolean;
      streetViewControl: boolean;
      fullscreenControl: boolean;
      clickableIcons: boolean;
      gestureHandling: string;
      styles: Array<Record<string, unknown>>;
    }) => unknown;
  };
};

declare global {
  interface Window {
    google?: GoogleMapsApi;
  }
}

let mapsScriptPromise: Promise<GoogleMapsApi> | null = null;

function loadGoogleMaps(apiKey: string): Promise<GoogleMapsApi> {
  if (window.google?.maps) return Promise.resolve(window.google);
  if (mapsScriptPromise) return mapsScriptPromise;

  mapsScriptPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-7even-google-maps]');
    const script = existing ?? document.createElement('script');
    const timeout = window.setTimeout(() => reject(new Error('Google Maps took too long to load.')), 12000);

    const finish = () => {
      window.clearTimeout(timeout);
      if (window.google?.maps) resolve(window.google);
      else reject(new Error('Google Maps did not initialize.'));
    };
    script.addEventListener('load', finish, { once: true });
    script.addEventListener('error', () => {
      window.clearTimeout(timeout);
      reject(new Error('Google Maps could not load.'));
    }, { once: true });

    if (!existing) {
      script.dataset.sevenGoogleMaps = 'true';
      script.async = true;
      script.defer = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
      document.head.appendChild(script);
    }
  }).catch((error: unknown) => {
    mapsScriptPromise = null;
    throw error;
  });

  return mapsScriptPromise;
}

const nigeriaOverview = { lat: 9.082, lng: 8.6753 };

export function GoogleMapsScene() {
  const sectionRef = useRef<HTMLElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? '';

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === 'undefined') {
      setNearViewport(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px 0px' },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!nearViewport || !apiKey || !mapRef.current) return;
    let cancelled = false;
    void loadGoogleMaps(apiKey)
      .then((google) => {
        if (cancelled || !mapRef.current) return;
        new google.maps.Map(mapRef.current, {
          center: nigeriaOverview,
          zoom: 6,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          gestureHandling: 'cooperative',
          styles: [
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
          ],
        });
        setMapReady(true);
        setMapError('');
      })
      .catch(() => {
        if (!cancelled) setMapError('The live map could not load right now.');
      });
    return () => {
      cancelled = true;
    };
  }, [nearViewport, apiKey]);

  return (
    <section className="seven-map-scene" ref={sectionRef} aria-labelledby="seven-map-title">
      <div className="seven-map-copy">
        <p className="public-eyebrow">A clearer sense of place</p>
        <h2 id="seven-map-title">Explore Nigeria, with location you can trust.</h2>
        <p>
          This geographic overview is a map foundation, not a claim that a property is available.
          Property pins will appear only when 7even has verified coordinates for that listing.
        </p>
        <p className="seven-map-status" role="status">
          {!apiKey
            ? 'Live map preview is waiting for an authorized Google Maps browser key.'
            : mapError
              ? mapError
              : mapReady
                ? 'Geographic overview loaded. No property pins are shown until verified coordinates are available.'
                : 'Loading the geographic overview when it comes into view…'}
        </p>
      </div>
      <div className="seven-map-frame">
        {apiKey ? (
          <div
            className="seven-map-canvas"
            ref={mapRef}
            role="img"
            aria-label="Google Maps geographic overview of Nigeria. No property markers are displayed."
          />
        ) : (
          <div className="seven-map-fallback" role="img" aria-label="Map preview unavailable until Google Maps is configured">
            <span className="seven-map-fallback-mark" aria-hidden="true">7</span>
            <strong>Location-first discovery</strong>
            <span>Verified property markers will appear here when the map and approved coordinates are connected.</span>
          </div>
        )}
        {apiKey && mapError && (
          <div className="seven-map-overlay" role="status">
            <strong>Map temporarily unavailable</strong>
            <span>Search and listing details remain available below.</span>
          </div>
        )}
      </div>
      <p className="seven-map-disclaimer">
        Map view only. It does not request your location or change search, booking, or payment state.
      </p>
    </section>
  );
}
