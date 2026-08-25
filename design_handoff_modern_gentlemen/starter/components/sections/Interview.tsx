interface QA {
  q: string;
  a: string;
}

/** The Interview — Q&A (library #15). Also covers #17 Letter from the Editor
 *  when passed a single long-form entry. */
export function Interview({
  eyebrow,
  headline,
  subject,
  qa,
}: {
  eyebrow?: string;
  headline: string;
  subject?: string;
  qa: QA[];
}) {
  return (
    <section className="container-mg py-16 md:py-24 max-w-3xl">
      {eyebrow && <div className="font-serif italic text-mg-accentSerif text-xl">{eyebrow}</div>}
      <h2 className="font-grotesk font-semibold text-3xl md:text-5xl mt-2 text-balance">
        {headline}
      </h2>
      {subject && (
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.18em] text-mg-fg/50">
          {subject}
        </p>
      )}
      <div className="mt-10 space-y-8">
        {qa?.map((item, i) => (
          <div key={i}>
            <p className="font-grotesk text-lg text-mg-accentInk text-pretty">{item.q}</p>
            <p className="mt-2 text-mg-fg/80 leading-relaxed text-pretty">{item.a}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
