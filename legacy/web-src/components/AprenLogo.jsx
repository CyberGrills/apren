export default function AprenLogo({
  className = "",
  size = 48
}) {
  return (
    <img
      src="/icons/apren-logo.png"
      alt="āprən"
      width={size}
      height={size}
      className={className}
      style={{
        objectFit: "contain"
      }}
    />
  );
}
