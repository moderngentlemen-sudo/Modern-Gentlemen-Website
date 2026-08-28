interface Entry {
  year: string;
  title: string;
  body?: string;
}

/** A Brief History — timeline (library #16). Also fits #24 Calendar. */
export function Timeline({ heading, entries }: { heading?: string; entries: Entry[] }) {
  return (
    <section className="container-mg py-16 md:py-24">
      {heading && <h2 className="font-grotesk text-2xl md:text-3xl mb-10">{heading}</h2>}
      <div className="border-l border-mg-bd/20">
        {entries?.map((e, i) => (
          <div key={i} className="relative pl-8 pb-10 last:pb-0">
            <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-mg-accent" />
            <div className="font-mono text-sm text-mg-accentInk">{e.year}</div>
            <h3 className="font-grotesk text-xl mt-1">{e.title}</h3>
            {e.body && <p className="mt-2 text-mg-fg/70 text-pretty max-w-xl">{e.body}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
