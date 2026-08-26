/**
 * The content marker, made visible — the preview route's stand-in for a page.
 *
 * `DocumentContent` renders nothing, which is right on the live site (the
 * page's own sections have replaced it long before the renderer sees the tree)
 * and useless in a preview of the template *by itself*: an editor looking at a
 * header band sitting directly on top of a footer band cannot tell whether the
 * marker is between them, above them, or missing entirely — and "missing
 * entirely" is the one state publish validation refuses. An invisible gap is
 * indistinguishable from no gap.
 *
 * So the preview route splices one of these in at the marker instead, through
 * `applyTemplate` — the same substitution the live site performs with the
 * page's real sections, which is what makes a nested marker (inside a
 * `columns`/`column`) land in the right place here for free rather than by a
 * second rule that could drift from the first.
 *
 * ⚠️ **It is a real registered block, not a renderer special case**, for the
 * reason `DocumentContent`'s own header gives: `validateBlock` refuses a
 * `_type` with no manifest. A synthesized node never reaches publish
 * validation today, but the moment one did — a "save what I'm previewing"
 * feature, a revision written from a composed tree — the failure would land at
 * publish, the last place with an editor to tell.
 *
 * `hidden: true` keeps it out of the library, so nobody can author one. If
 * somebody hand-writes one into a payload anyway it renders this band on the
 * live site, which is the honest outcome: a block called "page content gap"
 * showing a page content gap.
 */
export function DocumentContentGap() {
  return (
    <div className="container-mg my-10">
      <div className="border border-dashed border-mg-fg/25 px-6 py-10 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-mg-fg/60">
          Page content
        </p>
        <p className="mt-3 font-serif text-lg italic text-mg-fg/60">
          Each page using this template renders its own sections here.
        </p>
      </div>
    </div>
  );
}
