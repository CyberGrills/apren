// biome-ignore-all lint/a11y/noNoninteractiveElementToInteractiveRole: Calendar tables and cells implement the ARIA grid pattern with roving focus on day buttons.
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import {
  addCalendarDays,
  addCalendarMonths,
  calendarKeyDate,
  calendarMinimum,
  calendarWeeks,
  formatCalendarDate,
  lagosToday,
  parseCalendarDate,
} from '../lib/datePicker.ts';
import '../styles/date-picker.css';

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export type DatePickerProps = {
  name: string;
  id?: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  label?: ReactNode;
};

export function DatePicker({ name, id, value, onChange, min, label = 'Date' }: DatePickerProps) {
  const generatedId = useId();
  const fieldId = id ?? `date-picker-${generatedId}`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const focusDayRef = useRef(false);
  const [open, setOpen] = useState(false);
  const today = lagosToday();
  const minimum = calendarMinimum(min, today);
  const initialDate = parseCalendarDate(value) && value >= minimum ? value : minimum;
  const [focusedDate, setFocusedDate] = useState(initialDate);
  const [displayedMonth, setDisplayedMonth] = useState(`${initialDate.slice(0, 7)}-01`);
  const shown = {
    year: Number(displayedMonth.slice(0, 4)),
    month: Number(displayedMonth.slice(5, 7)),
  };
  const earliest = { year: Number(minimum.slice(0, 4)), month: Number(minimum.slice(5, 7)) };
  const selectedLabel = formatCalendarDate(value);
  const monthTitle = `${months[shown.month - 1]} ${shown.year}`;
  const previousMonth = addCalendarMonths(displayedMonth, -1);
  const previousMonthEnd = addCalendarDays(displayedMonth, -1);
  const nextMonth = addCalendarMonths(displayedMonth, 1);
  const lastYear = Math.min(9999, Math.max(earliest.year + 10, shown.year + 1));
  const years = Array.from(
    { length: lastYear - earliest.year + 1 },
    (_, index) => earliest.year + index,
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    if (!dialog.open) dialog.showModal();
    if (focusDayRef.current) {
      dialog.querySelector<HTMLButtonElement>(`[data-date="${focusedDate}"]`)?.focus();
      focusDayRef.current = false;
    }
  }, [open, focusedDate]);

  function closeCalendar() {
    dialogRef.current?.close();
    setOpen(false);
    triggerRef.current?.focus();
  }

  function showCalendar() {
    const firstDate = parseCalendarDate(value) && value >= minimum ? value : minimum;
    focusDayRef.current = true;
    setFocusedDate(firstDate);
    setDisplayedMonth(`${firstDate.slice(0, 7)}-01`);
    setOpen(true);
  }

  function focusDate(date: string, moveFocus = true) {
    if (!parseCalendarDate(date)) return;
    const availableDate = date < minimum ? minimum : date;
    focusDayRef.current = moveFocus;
    setFocusedDate(availableDate);
    setDisplayedMonth(`${availableDate.slice(0, 7)}-01`);
  }

  function changeMonth(year: number, month: number, moveFocus = false) {
    const focused = parseCalendarDate(focusedDate);
    if (!focused) return;
    focusDate(
      addCalendarMonths(focusedDate, (year - focused.year) * 12 + month - focused.month),
      moveFocus,
    );
  }

  function selectDate(date: string) {
    if (parseCalendarDate(date) && date >= minimum) {
      onChange(date);
      closeCalendar();
    }
  }

  return (
    <div className="date-picker">
      <label className="date-picker__label" id={`${fieldId}-label`} htmlFor={fieldId}>
        {label}
      </label>
      <input type="hidden" name={name} value={value} />
      <button
        className={`date-picker__trigger${selectedLabel ? ' date-picker__trigger--selected' : ''}`}
        id={fieldId}
        ref={triggerRef}
        type="button"
        aria-labelledby={`${fieldId}-label ${fieldId}-value`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`${fieldId}-dialog`}
        onClick={showCalendar}
      >
        <span id={`${fieldId}-value`}>{selectedLabel || 'Choose a date'}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <dialog
        className="date-picker__dialog"
        id={`${fieldId}-dialog`}
        ref={dialogRef}
        aria-labelledby={`${fieldId}-title`}
        aria-describedby={`${fieldId}-hint`}
        onCancel={(event) => {
          event.preventDefault();
          closeCalendar();
        }}
        onClose={() => {
          setOpen(false);
          triggerRef.current?.focus();
        }}
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            closeCalendar();
        }}
      >
        <div className="date-picker__heading">
          <div>
            <h2 id={`${fieldId}-title`}>
              {typeof label === 'string' && label !== 'Date' ? label : 'Choose a date'}
            </h2>
          </div>
          <button
            className="date-picker__icon-button"
            type="button"
            aria-label="Close calendar"
            onClick={closeCalendar}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="date-picker__navigation">
          <button
            className="date-picker__icon-button"
            type="button"
            aria-label="Previous month"
            disabled={!previousMonth || previousMonthEnd < minimum}
            onClick={() => focusDate(addCalendarMonths(focusedDate, -1))}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <div className="date-picker__selectors">
            <select
              aria-label="Month"
              value={shown.month}
              onChange={(event) => changeMonth(shown.year, Number(event.target.value))}
            >
              {months.map((month, index) => (
                <option
                  key={month}
                  value={index + 1}
                  disabled={shown.year === earliest.year && index + 1 < earliest.month}
                >
                  {month}
                </option>
              ))}
            </select>
            <select
              aria-label="Year"
              value={shown.year}
              onChange={(event) => changeMonth(Number(event.target.value), shown.month)}
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
          <button
            className="date-picker__icon-button"
            type="button"
            aria-label="Next month"
            disabled={!nextMonth}
            onClick={() => focusDate(addCalendarMonths(focusedDate, 1))}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>
        <p
          className="date-picker__sr-only"
          id={`${fieldId}-month`}
          aria-live="polite"
          aria-atomic="true"
        >
          {monthTitle}
        </p>
        <table
          className="date-picker__calendar"
          role="grid"
          tabIndex={-1}
          aria-labelledby={`${fieldId}-month`}
          onKeyDown={(event) => {
            const next = calendarKeyDate(focusedDate, event.key, minimum, event.shiftKey);
            if (next) {
              event.preventDefault();
              focusDate(next);
            }
          }}
        >
          <thead>
            <tr className="date-picker__weekdays">
              {weekdays.map((day) => (
                <th key={day} scope="col" abbr={day}>
                  {day.slice(0, 2)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {calendarWeeks(displayedMonth).map((week) => (
              <tr className="date-picker__week" key={week.find((day) => day !== null)}>
                {week.map((day, column) => (
                  <td
                    key={day ?? weekdays[column]}
                    role="gridcell"
                    tabIndex={-1}
                    aria-selected={day ? day === value : undefined}
                  >
                    {day && (
                      <button
                        className="date-picker__day"
                        type="button"
                        data-date={day}
                        tabIndex={day === focusedDate ? 0 : -1}
                        aria-label={formatCalendarDate(day, true)}
                        aria-current={day === today ? 'date' : undefined}
                        disabled={day < minimum}
                        onFocus={() => setFocusedDate(day)}
                        onClick={() => selectDate(day)}
                      >
                        {Number(day.slice(-2))}
                      </button>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="date-picker__footer">
          <p className="date-picker__selection">
            <CalendarDays size={17} aria-hidden="true" />
            <span>
              {selectedLabel ? `Selected: ${selectedLabel}` : 'Pick a day for your plans.'}
            </span>
          </p>
          {value && (
            <button
              className="date-picker__today"
              type="button"
              onClick={() => {
                onChange('');
                closeCalendar();
              }}
            >
              Clear date
            </button>
          )}
          <button
            className="date-picker__today"
            type="button"
            disabled={today < minimum}
            onClick={() => selectDate(today)}
          >
            Today
          </button>
        </div>
        <p className="date-picker__hint" id={`${fieldId}-hint`}>
          Use arrow keys to move between days. Page Up and Page Down change months.
        </p>
      </dialog>
    </div>
  );
}
