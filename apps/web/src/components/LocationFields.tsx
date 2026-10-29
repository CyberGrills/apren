import {
  decodeNigeriaStateLocations,
  findNigeriaState,
  type NigeriaLocation,
  type NigeriaStateLocationData,
  nigeriaStateDataPath,
  nigeriaStates,
  uniqueNigeriaCities,
} from '@7even/contracts';
import { MapPin } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { api } from '../lib/api.ts';
import { ErrorNotice } from './ui.tsx';
import './location-fields.css';

const stateCache = new Map<string, NigeriaLocation[]>();

export function StateCityFields({
  initialState = '',
  initialCity = '',
  required = false,
  prefix = 'location',
}: {
  initialState?: string | null;
  initialCity?: string;
  required?: boolean;
  prefix?: string;
}) {
  const [state, setState] = useState(findNigeriaState(initialState ?? '')?.name ?? '');
  const [city, setCity] = useState(initialCity);
  const [cities, setCities] = useState<NigeriaLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!state) {
      setCities([]);
      setLoading(false);
      setError(false);
      return;
    }
    const cached = stateCache.get(state);
    if (cached) {
      setCities(cached);
      setLoading(false);
      setError(false);
      return;
    }
    const controller = new AbortController();
    setCities([]);
    setLoading(true);
    setError(false);
    fetch(`${nigeriaStateDataPath(state)}${attempt ? `?retry=${attempt}` : ''}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Location list unavailable');
        const data: NigeriaStateLocationData = await response.json();
        const next = uniqueNigeriaCities(decodeNigeriaStateLocations(data));
        if (controller.signal.aborted) return;
        stateCache.set(state, next);
        setCities(next);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [state, attempt]);
  return (
    <>
      <div className="location-field">
        <label htmlFor={`${prefix}-state`}>State</label>
        <select
          id={`${prefix}-state`}
          name="state"
          value={state}
          required={required}
          onChange={(event) => {
            setState(event.target.value);
            setCity('');
          }}
        >
          <option value="">{required ? 'Select a state' : 'All states in Nigeria'}</option>
          {nigeriaStates.map((item) => (
            <option key={item.code} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <div className="location-field">
        <label htmlFor={`${prefix}-city`}>City or area</label>
        <select
          id={`${prefix}-city`}
          name="city"
          value={city}
          required={required}
          disabled={!required && !city && (!state || loading || error)}
          onChange={(event) => setCity(event.target.value)}
        >
          <option value="">
            {loading
              ? 'Loading cities…'
              : !state
                ? 'Select a state first'
                : required
                  ? 'Select a city or area'
                  : 'All cities and areas'}
          </option>
          {city && !cities.some((item) => item.name === city) && (
            <option value={city}>
              {city}
              {!state ? ' (current search)' : ''}
            </option>
          )}
          {cities.map((item) => (
            <option key={item.id} value={item.name}>
              {item.name}
            </option>
          ))}
        </select>
        {error && (
          <ErrorNotice
            message="Cities could not load. Please try again."
            retry={() => setAttempt((value) => value + 1)}
          />
        )}
      </div>
    </>
  );
}

export function DestinationInput({
  value,
  onChange,
  onSelect,
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (location: NigeriaLocation) => void;
}) {
  const id = useId();
  const inputId = `${id}-input`;
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<NigeriaLocation[]>([]);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setOptions([]);
    setActive(-1);
    setError(false);
    const timer = window.setTimeout(
      () => {
        api<NigeriaLocation[]>(`/locations?q=${encodeURIComponent(value.trim())}`, {
          signal: controller.signal,
        })
          .then((next) => {
            setOptions(next);
            setActive(-1);
          })
          .catch(() => {
            if (!controller.signal.aborted) setError(true);
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      value ? 160 : 0,
    );
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value, open]);
  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  useEffect(() => {
    if (open && active >= 0)
      document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, id]);
  function select(location: NigeriaLocation) {
    onSelect(location);
    setOpen(false);
    setActive(-1);
  }
  return (
    <div className="destination-control" ref={root}>
      <label htmlFor={inputId}>Where</label>
      <div className="seven-search-input-wrap">
        <MapPin size={16} aria-hidden="true" />
        <input
          id={inputId}
          value={value}
          placeholder="Start with Uyo, or explore Nigeria"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={`${id}-options`}
          aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
          autoComplete="off"
          maxLength={160}
          onFocus={() => setOpen(true)}
          onBlur={(event) => {
            if (!root.current?.contains(event.relatedTarget)) setOpen(false);
          }}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              setOpen(false);
              return;
            }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              setActive((index) => {
                if (!options.length) return -1;
                if (index < 0) return event.key === 'ArrowDown' ? 0 : options.length - 1;
                return (
                  (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
                );
              });
            }
            if (event.key === 'Enter' && open && active >= 0 && options[active]) {
              event.preventDefault();
              select(options[active]);
            }
          }}
        />
      </div>
      {open && (
        <div className="destination-popover">
          <p className="destination-caption">
            {value.trim()
              ? 'Cities, towns and areas across Nigeria'
              : 'Start in Uyo. Go anywhere in Nigeria.'}
          </p>
          <div
            id={`${id}-options`}
            role="listbox"
            aria-label="Destinations in Nigeria"
            aria-busy={loading}
          >
            {options.map((item, index) => (
              <div
                key={item.id}
                id={`${id}-${index}`}
                role="option"
                tabIndex={-1}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    select(item);
                  }
                }}
                aria-selected={active === index}
                className={active === index ? 'active' : ''}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => select(item)}
              >
                <MapPin size={18} aria-hidden="true" />
                <span>
                  <strong>{item.name}</strong>
                  <small>
                    {item.state}
                    {item.area ? ` · ${item.area}` : ''}
                  </small>
                </span>
                {item.name === 'Uyo' && item.state === 'Akwa Ibom' && (
                  <span className="destination-launch">Launch city</span>
                )}
              </div>
            ))}
          </div>
          <p className="destination-status" role="status">
            {loading
              ? 'Finding destinations…'
              : error
                ? 'Suggestions could not load. You can still type a city and search.'
                : options.length === 0
                  ? 'No matching town found. You can still search this name.'
                  : `${options.length} suggestions. Use the arrow keys to choose.`}
          </p>
          <a
            className="destination-credit"
            href="https://www.geonames.org/"
            target="_blank"
            rel="noreferrer"
          >
            Location data: GeoNames
          </a>
        </div>
      )}
    </div>
  );
}
