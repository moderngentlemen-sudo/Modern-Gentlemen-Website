import Link from "next/link";

const COLUMNS = [
  { title: "Shop", links: [["All", "/shop"], ["Style", "/shop?cat=Style"], ["Watches", "/shop?cat=Watches"], ["Grooming", "/shop?cat=Grooming"]] },
  { title: "Editorial", links: [["Style", "/style"], ["Grooming", "/grooming"], ["Watches", "/watches"], ["Culture", "/culture"], ["Film", "/film"]] },
  { title: "Company", links: [["About", "/about"], ["Membership", "/membership"], ["Contact", "/contact"]] },
];

/** Footer is ALWAYS dark, regardless of theme — do not wire to data-mgtheme. */
export function Footer() {
  return (
    <footer className="bg-[#0d0d0d] text-[#f4f4f4] mt-20">
      <div className="container-mg py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          <div>
            <div className="font-grotesk font-bold text-2xl">Modern Gentlemen</div>
            <p className="mt-3 text-white/50 text-sm max-w-xs text-pretty">
              Style, grooming, watches, culture and film — for the considered man.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h4 className="font-mono text-xs uppercase tracking-[0.2em] text-mg-accent mb-4">{col.title}</h4>
              <ul className="space-y-2">
                {col.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="text-white/70 hover:text-white text-sm">{label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between gap-3 text-white/40 text-xs font-mono">
          <span>© {new Date().getFullYear()} Modern Gentlemen</span>
          <div className="flex gap-6">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
