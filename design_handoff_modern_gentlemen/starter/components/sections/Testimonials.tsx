interface Quote {
  text: string;
  name: string;
  detail?: string;
}

/** Member Voices — testimonials (library #18). Also fits #06 Contributor Spotlight. */
export function Testimonials({ heading, quotes }: { heading?: string; quotes: Quote[] }) {
  return (
    <section className="container-mg py-16 md:py-24">
      {heading && <h2 className="font-grotesk text-2xl md:text-3xl mb-8">{heading}</h2>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {quotes?.map((q, i) => (
          <figure key={i} className="border border-mg-bd/15 p-7 flex flex-col">
            <blockquote className="font-grotesk text-lg leading-snug text-pretty flex-1">
              &ldquo;{q.text}&rdquo;
            </blockquote>
            <figcaption className="mt-6">
              <div className="font-grotesk text-sm">{q.name}</div>
              {q.detail && (
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-mg-fg/45 mt-1">
                  {q.detail}
                </div>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
