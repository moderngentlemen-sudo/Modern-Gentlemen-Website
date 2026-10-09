/**
 * A text box where selected words can become a link: select, press Link (or
 * ⌘K), type where it should go. Stored as `[words](where)`, which the renderer
 * turns into a real link.
 */
import { useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Link2 } from "lucide-react";
import { toast } from "../store/editor";

export function wrapLink(text: string, start: number, end: number, target: string): string {
  const words = text.slice(start, end).replace(/[[\]]/g, "");
  return `${text.slice(0, start)}[${words}](${target.trim()})${text.slice(end)}`;
}

/** Shared ⌘K/Link behaviour for any textarea or input. */
export function useLinker(el: RefObject<HTMLTextAreaElement | HTMLInputElement | null>, value: string, onChange: (v: string) => void) {
  const [range, setRange] = useState<[number, number] | null>(null);
  const [target, setTarget] = useState("");
  const start = () => {
    const node = el.current;
    if (!node) return;
    const a = node.selectionStart ?? 0;
    const b = node.selectionEnd ?? 0;
    if (a === b) return toast("Select the words you want to link first", "info");
    setRange([a, b]);
    setTarget("");
  };
  const close = () => {
    setRange(null);
    requestAnimationFrame(() => el.current?.focus());
  };
  const apply = () => {
    if (range && target.trim()) onChange(wrapLink(value, range[0], range[1], target));
    close();
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      start();
    }
  };
  const popover = range ? (
    <div className="link-pop" onPointerDown={(e) => e.stopPropagation()}>
      <span className="hint">Link “{value.slice(range[0], range[1]).slice(0, 30)}” to</span>
      <div className="row">
        <input
          className="input sm"
          autoFocus
          placeholder="Website, email or phone"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              close();
            }
          }}
          aria-label="Link destination"
          data-testid="link-target"
        />
        <button className="btn sm primary" onMouseDown={(e) => e.preventDefault()} onClick={apply} data-testid="link-apply">
          Add link
        </button>
      </div>
    </div>
  ) : null;
  return { start, onKey, popover, open: !!range };
}

export function LinkableText({ label, value, onChange, testId }: { label: string; value: string; onChange: (v: string) => void; testId?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const linker = useLinker(ref, value, onChange);
  return (
    <div className="field">
      <label className="row" style={{ justifyContent: "space-between" }}>
        <span>{label}</span>
        <button
          type="button"
          className="btn sm ghost"
          onMouseDown={(e) => e.preventDefault()}
          onClick={linker.start}
          title="Link selected words (⌘K)"
          data-testid="link-words"
        >
          <Link2 size={13} /> Link
        </button>
      </label>
      <textarea ref={ref} className="textarea" value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={linker.onKey} data-testid={testId} />
      {linker.popover}
      <span className="hint">Select words and press Link (⌘K) to make them clickable.</span>
    </div>
  );
}
