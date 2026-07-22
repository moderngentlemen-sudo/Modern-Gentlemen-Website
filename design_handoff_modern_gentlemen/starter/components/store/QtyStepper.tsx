/** Quantity stepper: – / n / +. Caller wires the handlers (PDP clamps at 1;
 *  Bag lets `–` at qty 1 remove the line via setQty(0)). */
export function QtyStepper({ qty, onDec, onInc }: { qty: number; onDec: () => void; onInc: () => void }) {
  return (
    <div className="inline-flex items-center border border-mg-bd/30">
      <button type="button" aria-label="Decrease quantity" onClick={onDec} className="px-4 py-2.5 text-lg leading-none hover:text-mg-accent">–</button>
      <span className="px-4 font-mono text-sm tabular-nums" aria-live="polite">{qty}</span>
      <button type="button" aria-label="Increase quantity" onClick={onInc} className="px-4 py-2.5 text-lg leading-none hover:text-mg-accent">+</button>
    </div>
  );
}
