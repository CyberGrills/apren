import {
  type FocusEvent,
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { searchLocations } from '../lib/locationSearch.ts';

const MAX_VISIBLE = 50;

/** The least a suggestion needs to be shown. NigeriaLocation already satisfies this. */
export interface PlaceOption {
  id: string | number;
  name: string;
  area?: string | null;
  state?: string | null;
  /** Replaces the default "area, state" line under the name. */
  detail?: string;
}

export function LocationCombobox<T extends PlaceOption>({
  id,
  name,
  value,
  onChange,
  onSelectOption,
  options,
  loading = false,
  serverFiltered = false,
  required = false,
  strict = false,
  placeholder,
  hint,
}: {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onSelectOption?: (option: T) => void;
  options: readonly T[];
  loading?: boolean;
  /** True when the options already match the typed text, because they were filtered elsewhere. */
  serverFiltered?: boolean;
  required?: boolean;
  /** Only accept a place from the list, for forms that need a canonical location. */
  strict?: boolean;
  placeholder?: string;
  /** Shown when nothing is typed and there is nothing to suggest yet. */
  hint?: string;
}) {
  const listId = useId();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = value.trim();
  const typedKey = typed.toLocaleLowerCase('en-NG');
  // A saved value the form opened with stays valid until the user changes it.
  const initialKey = useRef(typedKey).current;
  const matches = useMemo(
    () =>
      serverFiltered ? options.slice(0, MAX_VISIBLE) : searchLocations(options, value, MAX_VISIBLE),
    [options, value, serverFiltered],
  );
  const listVisible = open && matches.length > 0;
  const moreHidden = !serverFiltered && !typed && options.length > matches.length;

  let emptyText = '';
  if (loading) emptyText = 'Loading places.';
  else if (matches.length === 0 && typed)
    emptyText = strict
      ? 'No matching place. Choose one from the list.'
      : `No matching place. You can still search for "${typed}".`;
  else if (matches.length === 0) emptyText = hint ?? '';
  const popupVisible = open && (matches.length > 0 || emptyText !== '');
  const statusText = !open
    ? ''
    : matches.length > 0
      ? `${matches.length} ${matches.length === 1 ? 'suggestion' : 'suggestions'} available. Use the up and down arrow keys, then Enter to choose.`
      : emptyText;

  useEffect(() => {
    const field = input.current;
    if (!field) return;
    if (!strict || !typed || typedKey === initialKey) {
      field.setCustomValidity('');
    } else if (loading) {
      field.setCustomValidity('Places are still loading. Please wait a moment.');
    } else {
      const known = options.some((item) => item.name.toLocaleLowerCase('en-NG') === typedKey);
      field.setCustomValidity(known ? '' : 'Choose a city or area from the suggestions.');
    }
  }, [strict, typed, typedKey, initialKey, options, loading]);

  useEffect(() => {
    if (active >= 0)
      document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, listId]);

  function choose(item: T) {
    onChange(item.name);
    onSelectOption?.(item);
    setOpen(false);
    setActive(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (matches.length === 0) return;
      event.preventDefault();
      const forward = event.key === 'ArrowDown';
      if (!open) {
        setOpen(true);
        setActive(forward ? 0 : matches.length - 1);
        return;
      }
      setActive((index) => {
        if (index < 0) return forward ? 0 : matches.length - 1;
        return (index + (forward ? 1 : -1) + matches.length) % matches.length;
      });
      return;
    }
    if (event.key === 'Enter') {
      const item = listVisible ? matches[active] : undefined;
      if (item) {
        event.preventDefault();
        choose(item);
      }
      return;
    }
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
        setActive(-1);
      } else if (value) {
        event.preventDefault();
        onChange('');
      }
      return;
    }
    if (event.key === 'Tab') setOpen(false);
  }

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    if (root.current?.contains(event.relatedTarget)) return;
    setOpen(false);
    setActive(-1);
    if (strict && typed) {
      const match = options.find((item) => item.name.toLocaleLowerCase('en-NG') === typedKey);
      if (match && match.name !== value) onChange(match.name);
    }
  }

  return (
    <div className="location-combobox" ref={root}>
      <input
        ref={input}
        id={id}
        name={name}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={listVisible}
        aria-controls={listVisible ? listId : undefined}
        aria-activedescendant={listVisible && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        maxLength={160}
        required={required}
        placeholder={placeholder}
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          onChange(event.target.value);
          setActive(-1);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {statusText}
      </p>
      {popupVisible && (
        <div className="location-combobox-popover">
          {matches.length > 0 ? (
            <div id={listId} role="listbox" aria-label="Places" className="location-combobox-list">
              {matches.map((item, index) => (
                <div
                  key={item.id}
                  id={`${listId}-${index}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={active === index}
                  className={active === index ? 'active' : undefined}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(item);
                  }}
                >
                  <strong>{item.name}</strong>
                  <small>
                    {item.detail ?? [item.area, item.state].filter(Boolean).join(', ')}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <p className="location-combobox-note">{emptyText}</p>
          )}
          {moreHidden && matches.length > 0 && (
            <p className="location-combobox-note">
              Showing {matches.length} of {options.length}. Keep typing to narrow the list.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
