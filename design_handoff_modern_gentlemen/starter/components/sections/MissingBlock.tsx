export function MissingBlock({ type }: { type: string }) {
  return (
    <div className="container-mg my-6">
      <div className="border border-dashed border-mg-accent/60 p-6 font-mono text-sm text-mg-accentInk">
        Unknown section block: <strong>{type}</strong> — add it to components/sections/registry.ts
      </div>
    </div>
  );
}
