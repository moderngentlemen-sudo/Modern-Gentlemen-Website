/**
 * A `<script type="application/ld+json">` block.
 *
 * **Renders nothing.** A script tag has no box, so this can be dropped into any
 * route without moving a pixel — which is the property that lets structured data
 * land on pages the visual baselines guard.
 *
 * `<` is escaped to `<` before the JSON reaches `dangerouslySetInnerHTML`.
 * That is not decoration: a product blurb containing the literal text
 * `</script>` would otherwise close this element early and spill the rest of the
 * payload into the document as markup. JSON treats `<` as identical to
 * `<`, so every consumer reads the same value; only the HTML parser is fooled.
 * The content here is editor-supplied, so this is the injection that matters.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
