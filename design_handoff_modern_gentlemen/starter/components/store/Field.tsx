/** Checkout form field with controlled value + inline error state
 *  (data-invalid → red border + pink tint + error text). */
export function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  optional,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  optional?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="font-mono uppercase text-[11px] tracking-[0.15em] text-mg-fg/60">
        {label}
        {optional && <span className="text-mg-fg/60"> (optional)</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        data-invalid={error ? "" : undefined}
        aria-invalid={!!error}
        className="mt-1.5 w-full border border-mg-bd/30 bg-transparent px-4 py-3 outline-none transition-colors focus:border-mg-accent data-[invalid]:border-mg-accentSerif data-[invalid]:bg-mg-accent/5"
      />
      {error && (
        <span className="mt-1 block font-mono text-[10px] text-mg-accentSerif">{error}</span>
      )}
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="font-mono uppercase text-[11px] tracking-[0.15em] text-mg-fg/60">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full border border-mg-bd/30 bg-transparent px-4 py-3 outline-none transition-colors focus:border-mg-accent"
      >
        {options.map((o) => (
          <option key={o} value={o} className="bg-mg-bg text-mg-fg">
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
