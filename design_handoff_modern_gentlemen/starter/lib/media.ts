/**
 * Cover/film video sources carried over from the design prototype
 * (`design_files/Modern Gentlemen Homepage.dc.html` — `heroVideoUrl`,
 * `film1Url…film3Url` prop defaults).
 *
 * ⚠️ NOW UNSET. The prototype's defaults were third-party files hotlinked
 * straight from the mockup, and both were doing real damage:
 *
 *  1. Weight. The hero trailer measures **38.8 MB** and autoplays as soon as it
 *     is 35% visible, which on the homepage is immediately. The film clip is a
 *     4K/60fps Wikimedia file measuring **1.9 GB**, streamed into a 240px-tall
 *     tile on scroll-in and again on hover of any of the three tiles. See
 *     `/PERFORMANCE.md` for the measurements.
 *  2. Rights. Neither file is ours to serve — already flagged under Phase 7
 *     "Production imagery/video rights" in PROGRESS.md.
 *
 * Every video code path is intact. `HeroCoverStar` and `FilmStills` fall back to
 * the still, which was always doubling as the poster, so both sections render
 * exactly as before minus the motion — the same stance `ArticleHero` already
 * takes for its Film Feature variant. Point these at owned, self-hosted footage
 * and playback turns back on with no component changes.
 *
 * Budget for the replacements: 1920×1080 max, 6–10 s, muted, H.264 MP4 with a
 * WebM sibling, under ~2.5 MB each. Serve them from Supabase Storage alongside
 * the imagery (see `06_SUPABASE.md`), not from a third-party origin.
 */
export const HERO_COVER_VIDEO = "";

export const FILM_PREVIEW_VIDEO = "";
