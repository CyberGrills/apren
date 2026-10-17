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
      viewBox={compact ? '80 440 200 240' : '78 440 660 238'}
      role="img"
      aria-label="7even"
    >
      <image href="/brand/7even-logo.jpeg" width="810" height="1080" />
    </svg>
  );
}
