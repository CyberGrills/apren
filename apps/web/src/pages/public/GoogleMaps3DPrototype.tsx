import { useEffect, useRef, useState } from 'react';
import './GoogleMaps3DPrototype.css';

type CameraOptions = {
  center: { lat: number; lng: number; altitude: number };
  range: number;
  tilt: number;
  heading: number;
};

type Map3DElementLike = HTMLElement & {
  stopCameraAnimation?: () => void;
};

type Maps3DLibrary = {
  Map3DElement: new (options: CameraOptions & { mode: 'HYBRID' | 'SATELLITE' }) => Map3DElementLike;
};

type GoogleMapsWindow = Window & {
  google?: {
    maps?: {
      importLibrary?: (name: string) => Promise<unknown>;
    };
  };
  __sevenMapsReady?: () => void;
};

let mapsScriptPromise: Promise<void> | null = null;

function loadGoogleMaps(key: string): Promise<void> {
  const host = window as GoogleMapsWindow;
  if (host.google?.maps?.importLibrary) return Promise.resolve();
  if (mapsScriptPromise) return mapsScriptPromise;

  mapsScriptPromise = new Promise<void>((resolve, reject) => {
    const callbackName = '__sevenMapsReady';
    const script = document.createElement('script');
    script.id = 'seven-google-maps-script';
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=beta&callback=${callbackName}`;
    host.__sevenMapsReady = () => {
      delete host.__sevenMapsReady;
      resolve();
    };
    script.onerror = () => {
      delete host.__sevenMapsReady;
      mapsScriptPromise = null;
      reject(new Error('Google Maps could not be loaded. Check the API key, referrer restrictions and Maps JavaScript API access.'));
    };
    document.head.append(script);
  });

  return mapsScriptPromise;
}

export function GoogleMaps3DPrototype() {
  const mapHost = useRef<HTMLDivElement>(null);
  const mapElement = useRef<Map3DElementLike | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing-key' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim();

  useEffect(() => {
    let active = true;
    const host = mapHost.current;

    if (!apiKey) {
      setStatus('missing-key');
      setMessage('Add VITE_GOOGLE_MAPS_API_KEY to the local web environment to load the map.');
      return () => {
        active = false;
      };
    }

    setStatus('loading');
    setMessage('');

    void (async () => {
      try {
        await loadGoogleMaps(apiKey);
        const google = (window as GoogleMapsWindow).google;
        if (!google?.maps?.importLibrary) throw new Error('Google Maps loaded without its importLibrary function.');

        const library = (await google.maps.importLibrary('maps3d')) as Maps3DLibrary;
        if (!active || !host) return;

        const map = new library.Map3DElement({
          center: { lat: 5.0377, lng: 7.9128, altitude: 0 },
          range: 4200,
          tilt: 45,
          heading: 18,
          mode: 'HYBRID',
        });
        map.setAttribute('aria-label', 'Google 3D map preview centred on Uyo, Akwa Ibom State');
        map.className = 'seven-map-prototype__canvas';
        host.replaceChildren(map);
        mapElement.current = map;
        setStatus('ready');
      } catch (error) {
        if (!active) return;
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'The 3D map could not be initialized.');
      }
    })();

    return () => {
      active = false;
      mapElement.current?.stopCameraAnimation?.();
      mapElement.current?.remove();
      mapElement.current = null;
    };
  }, [apiKey, attempt]);

  return (
    <main className="seven-map-prototype">
      <header className="seven-map-prototype__intro">
        <p className="public-eyebrow">7even / Frontend engineering preview</p>
        <h1>Explore from a different angle.</h1>
        <p>
          A first Google 3D Maps foundation for the 45-degree visual direction. This preview uses
          an approximate Uyo city-centre view only; it does not mark a hotel or claim live inventory.
        </p>
      </header>

      <section className="seven-map-prototype__frame" aria-label="Uyo 3D map preview">
        <div ref={mapHost} className="seven-map-prototype__map-host">
          {status !== 'ready' && (
            <div className="seven-map-prototype__state" role="status" aria-live="polite">
              <strong>
                {status === 'loading'
                  ? 'Preparing the map'
                  : status === 'missing-key'
                    ? 'Map key not configured'
                    : 'Map preview unavailable'}
              </strong>
              <p>{message || 'The map will appear here when initialization completes.'}</p>
              {status === 'error' && (
                <button className="btn btn-secondary btn-small" type="button" onClick={() => setAttempt((value) => value + 1)}>
                  Try again
                </button>
              )}
            </div>
          )}
        </div>
        <div className="seven-map-prototype__caption">
          <span>Uyo, Akwa Ibom State · approximate city-centre preview</span>
          <span>45° camera tilt · hybrid imagery</span>
        </div>
      </section>

      <section className="seven-map-prototype__notes" aria-labelledby="map-prototype-notes">
        <h2 id="map-prototype-notes">What this prototype validates</h2>
        <ul>
          <li>Google Maps JavaScript API loading and the 3D Maps library.</li>
          <li>A fixed 45-degree camera perspective with satellite imagery and labels.</li>
          <li>A graceful no-key and load-error state instead of a broken blank panel.</li>
          <li>A separate development route, leaving the live booking journey unchanged.</li>
        </ul>
        <p>
          Hotel markers, scroll-linked camera choreography and production integration remain gated
          on verified property coordinates, API-key restrictions and browser/device testing.
        </p>
      </section>
    </main>
  );
}
