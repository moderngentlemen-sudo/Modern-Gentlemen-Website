export function Eyebrow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`font-serif italic text-mg-accentSerif text-lg ${className}`}>{children}</span>
  );
}

export function MonoLabel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`font-mono uppercase tracking-[0.2em] text-xs text-mg-accent ${className}`}>
      {children}
    </span>
  );
}
