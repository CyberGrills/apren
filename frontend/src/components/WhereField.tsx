import { findNigeriaState, type NigeriaLocation, nigeriaStates } from '@7even/contracts';
import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.ts';
import { searchLocations } from '../lib/locationSearch.ts';
import { describeWhere, whereFromText } from '../lib/whereText.ts';
import { LocationCombobox, type PlaceOption } from './LocationCombobox.tsx';

interface WhereOption extends PlaceOption {
  stateName: string;
  cityName: string;
}

const stateNames = nigeriaStates.map((item) => item.name);
const stateOptions: WhereOption[] = nigeriaStates.map((item) => ({
  id: `state-${item.code}`,
  name: item.name,
  detail: 'State',
  stateName: item.name,
  cityName: '',
}));

/**
 * One typed box for "state, city or area". It submits two hidden fields, state and city,
 * so the search form works exactly as it did with the two dropdowns.
 */
export function WhereField({
  prefix = 'where',
  initialState = '',
  initialCity = '',
}: {
  prefix?: string;
  initialState?: string | null;
  initialCity?: string;
}) {
  const startState = findNigeriaState(initialState ?? '')?.name ?? '';
  const startText = describeWhere(startState, initialCity);
  const [text, setText] = useState(startText);
  // The text that came from choosing a suggestion, so we do not search for it again.
  const [picked, setPicked] = useState(startText);
  const [selection, setSelection] = useState({ state: startState, city: initialCity });
  const [places, setPlaces] = useState<WhereOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = text.trim();
    if (query.length < 2 || text === picked) {
      setPlaces((current) => (current.length ? [] : current));
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      api<NigeriaLocation[]>(`/locations?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((next) => {
          if (controller.signal.aborted) return;
          setPlaces(
            next.map((item) => ({
              id: `place-${item.id}`,
              name: item.name,
              area: item.area,
              state: item.state,
              stateName: findNigeriaState(item.state)?.name ?? item.state,
              cityName: item.name,
            })),
          );
        })
        .catch(() => {
          if (!controller.signal.aborted) setPlaces([]);
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 160);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [text, picked]);

  const options = useMemo(() => {
    const query = text.trim();
    if (!query || text === picked) return [];
    return [...searchLocations(stateOptions, query, 5), ...places];
  }, [text, picked, places]);

  return (
    <div className="location-field where-field">
      <label htmlFor={`${prefix}-where`}>Where</label>
      <LocationCombobox
        id={`${prefix}-where`}
        value={text}
        onChange={(value) => {
          setText(value);
          setSelection(whereFromText(value, stateNames));
        }}
        onSelectOption={(option) => {
          const label = describeWhere(option.stateName, option.cityName);
          setText(label);
          setPicked(label);
          setSelection({ state: option.stateName, city: option.cityName });
        }}
        options={options}
        loading={loading}
        serverFiltered
        placeholder="Type a state, city or area, for example Uyo"
        hint="Start typing a state, city or area."
      />
      <input type="hidden" name="state" value={selection.state} />
      <input type="hidden" name="city" value={selection.city} />
    </div>
  );
}
