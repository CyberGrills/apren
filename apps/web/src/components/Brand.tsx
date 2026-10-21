export function Brand({
  compact = false,
  inverse = false,
}: {
  compact?: boolean;
  inverse?: boolean;
}) {
  return (
    <svg
      className={`brand${compact ? ' brand-compact' : ''}${inverse ? ' brand-inverse' : ''}`}
      viewBox={compact ? '0 0 184 214' : '0 0 566 214'}
      role="img"
      aria-label="7even"
    >
      <path className="brand-stroke-first" d="M0 0H184V25L84 214H63L165 20H8Z" />
      <path className="brand-stroke-second" d="M13 34H142L46 214H25L111 54H20Z" />
      {!compact && (
        <g className="brand-wordmark">
          <path d="M223 59H283V67H223ZM223 95H277V103H223ZM223 132H283V140H223Z" />
          <path d="M300 59H310L342 130L374 59H384L347 141H337Z" />
          <path d="M409 59H469V67H409ZM409 95H463V103H409ZM409 132H469V140H409Z" />
          <path d="M499 141V59H508L557 127V59H566V141H557L508 73V141Z" />
          <text className="brand-caption" x="223" y="177">
            HOSPITALITY DEMAND INTELLIGENCE
          </text>
        </g>
      )}
    </svg>
  );
}
