import { clsx } from "@/components/ui/clsx";
import { HAIRLINE, LABEL_SM } from "./styles";

/**
 * Hairline table primitives, shared by the pages list and the revision history.
 * Small enough to look like overkill until the same six class strings are
 * pasted into a second screen.
 *
 * The wrapper scrolls horizontally on its own so a wide table never makes the
 * page scroll sideways.
 */
export function Table({ children, caption }: { children: React.ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-[13px]">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={clsx("border-b px-3 py-2", HAIRLINE, LABEL_SM, className)}>
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <td className={clsx("border-b px-3 py-2.5 align-middle", HAIRLINE, className)}>{children}</td>
  );
}
