import { z } from "zod";
import { studioColor, studioGradient, studioDestination } from "./studioValues";
import { normalizeStudioMegaMenu, normalizeStudioVideo } from "./studioFeatures";
export { studioColor, studioGradient } from "./studioValues";
import { FONT_LIBRARY } from "@/lib/domain/fontLibrary";
import type { BlockNode } from "./types";
import { validateTree } from "./validate";
import { isStudioWidgetKind, normalizeStudioWidget } from "./studioWidgets";

export const STUDIO_SOURCE_KEY = "_designStudio";
const finite = z.number().finite().min(-100000).max(100000);
const sectionSchema = z
  .object({ uid: z.string().min(1).max(120), height: finite.positive() })
  .passthrough();
const nodeSchema = z
  .object({
    // Add/Duplicate use Date.now(); identifiers are not canvas coordinates.
    id: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    kind: z.string().max(80),
    x: finite,
    y: finite,
    w: finite.positive(),
    h: finite.positive(),
  })
  .passthrough();
const pageSchema = z
  .object({
    title: z.string().max(200).optional(),
    page: z.string().max(100),
    layoutDevice: z.enum(["desktop", "tablet", "mobile"]),
    sections: z.array(sectionSchema).min(1).max(100),
    nodes: z.array(nodeSchema).max(1000),
    workspace: z.never().optional(),
  })
  .passthrough();
export const studioSourceSchema = z
  .object({
    version: z.literal(1),
    source: pageSchema,
    views: z.object({ desktop: pageSchema, tablet: pageSchema, mobile: pageSchema }).strict(),
  })
  .strict()
  .refine(
    (value) => JSON.stringify(value).length <= 8_000_000,
    "Studio document is too large. Use hosted media URLs."
  );
export type StudioSource = z.infer<typeof studioSourceSchema>;

/** Source-only media (including unsupported sections) must remain protected in the catalogue. */
export function studioMediaReferences(document: StudioSource) {
  const references = new Map<string, { url: string; fieldPath: string }>();
  function visit(value: unknown, path: string) {
    if (typeof value === "string" && /^https?:\/\//.test(value)) {
      if (!references.has(value)) references.set(value, { url: value, fieldPath: path });
    } else if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) visit(item, `${path}.${key}`);
    }
  }
  visit(document, STUDIO_SOURCE_KEY);
  return [...references.values()];
}
export interface StudioIssue {
  path: string;
  message: string;
}

/** Convert only supported, faithful shapes. Never silently drop a section or substitute demo behavior. */
export function convertStudio(input: unknown): { sections: BlockNode[]; issues: StudioIssue[] } {
  const parsed = studioSourceSchema.safeParse(input);
  if (!parsed.success)
    return {
      sections: [],
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  const issues: StudioIssue[] = [],
    sections: BlockNode[] = [];
  const fail = (path: string, message: string) => issues.push({ path, message });
  for (const view of ["desktop", "tablet", "mobile"] as const) {
    const doc = parsed.data.views[view],
      width = { desktop: 760, tablet: 680, mobile: 390 }[view];
    if (doc.layoutDevice !== view) fail(view, "Refresh the responsive layouts before saving.");
    const ids = new Set<string>();
    let top = 0;
    for (const [index, section] of doc.sections.entries()) {
      const path = `${view}.sections.${index}`,
        anchor = `studio-${section.uid}-${view}`;
      if (ids.has(section.uid) || !/^[a-z0-9-]+$/i.test(section.uid))
        fail(path, "Section identifiers must be unique and use letters, numbers and hyphens.");
      ids.add(section.uid);
      const mega = section.megaMenu ? normalizeStudioMegaMenu(section.megaMenu) : undefined;
      for (const issue of mega?.issues || []) fail(path, issue);
      if (section.backgroundMedia)
        fail(path, "Section background media publishing needs its live renderer integration.");
      if ((section.separator as { enabled?: boolean } | undefined)?.enabled)
        fail(path, "Section separator publishing needs its live renderer integration.");
      const background = studioColor(section.color ?? doc.page);
      if (!background) fail(path, "Choose a supported background color.");
      let gradient: string | undefined;
      if (section.gradient) {
        const stops = Array.isArray(section.stops) ? section.stops : [];
        gradient = studioGradient(`linear-gradient(${section.angle}deg,${stops.join(",")})`);
        if (!gradient) fail(path, "Gradient stops need supported colors and positions.");
      }
      const children: BlockNode[] = [];
      for (const node of doc.nodes.filter((n) => n.y >= top && n.y < top + section.height)) {
        const nodePath = `${path}.nodes.${node.id}`;
        if (
          node.hidden ||
          (node.visibility as Record<string, unknown> | undefined)?.[view] === false
        )
          continue;
        if (
          !["text", "button", "divider", "media"].includes(node.kind) &&
          !isStudioWidgetKind(node.kind)
        ) {
          fail(
            nodePath,
            `${String(node.name || node.kind)} needs a live renderer integration before publishing.`
          );
          continue;
        }
        if (node.richHtml)
          fail(nodePath, "Formatted text needs its rich-text conversion before publishing.");
        const font = FONT_LIBRARY.find((f) => f.label === node.font || f.value === node.font);
        if (node.font && !font)
          fail(nodePath, "This font is not available in the live font library.");
        const settings: Record<string, unknown> = {
          kind:
            node.kind === "media" ? (node.mediaType === "video" ? "video" : "image") : node.kind,
          x: node.x,
          y: node.y - top,
          w: node.w,
          h: node.h,
          canvasWidth: width,
        };
        for (const key of [
          "text",
          "size",
          "weight",
          "leading",
          "tracking",
          "italic",
          "underline",
          "uppercase",
          "align",
          "radius",
          "thickness",
          "borderWidth",
          "opacity",
          "brightness",
          "contrast",
          "cropZoom",
          "focalX",
          "focalY",
          "fit",
          "alt",
        ])
          if (node[key] !== undefined) settings[key] = node[key];
        if (font) settings.fontFamily = font.value;
        settings.vertical = !!node.vertical && view !== "mobile";
        for (const key of ["color", "fill", "borderColor"])
          if (node[key] !== undefined) {
            const color = studioColor(node[key]);
            if (!color) fail(nodePath, `Choose a supported ${key} color.`);
            else settings[key] = color;
          }
        if (node.kind === "media") {
          const src = studioDestination(node.src, true);
          if (!src || src.startsWith("#"))
            fail(
              nodePath,
              `Choose a permanent ${node.mediaType === "video" ? "video" : "image"} URL before publishing; local uploads and temporary media cannot go live.`
            );
          else settings.src = src;
          if (node.mediaType === "video") {
            const video = normalizeStudioVideo(node.video, node.loop);
            if (video.success) settings.video = video.data;
            else fail(nodePath, "Check this video's playback settings.");
            if (node.poster) {
              const poster = studioDestination(node.poster, true);
              if (!poster) fail(nodePath, "Choose a permanent video poster image URL.");
              else settings.poster = poster;
            }
          }
        }
        if (node.kind === "button") {
          const action = node.action as
            { type?: string; url?: string; sectionId?: string } | undefined;
          const href =
            action?.type === "section" && doc.sections.some((s) => s.uid === action.sectionId)
              ? `#studio-${action.sectionId}-${view}`
              : action?.type === "url"
                ? studioDestination(action.url)
                : undefined;
          if (!href)
            fail(
              nodePath,
              `“${String(node.name || node.text || "Button").slice(0, 120)}” needs a destination. Open Button action and choose a section or enter a page URL, web, email or phone link.`
            );
          else {
            settings.href = href;
            if (action?.type === "url" && !/^(?:mailto:|tel:|#)/i.test(href))
              settings.newTab = true;
          }
        }
        if (isStudioWidgetKind(node.kind)) {
          const widget = normalizeStudioWidget(node.kind, node.widget);
          for (const issue of widget.issues) fail(nodePath, issue);
          if (widget.value) settings[node.kind] = widget.value;
        }
        children.push({
          _key: `studio-${view}-${index}-${node.id}`,
          _type: "studioElement",
          settings,
        });
      }
      sections.push({
        _key: `studio-${view}-${index}`,
        _type: "studioCanvas",
        visibility: { devices: [view] },
        settings: {
          sectionId: anchor,
          width,
          height: section.height,
          color: background,
          ...(gradient ? { gradient } : {}),
          ...(mega?.value ? { megaMenu: mega.value, mobile: view === "mobile" } : {}),
        },
        children,
      });
      top += section.height;
    }
    if (doc.nodes.some((n) => !n.hidden && (n.y < 0 || n.y >= top)))
      fail(view, "An element sits outside every section.");
    if (new Set(doc.nodes.map((n) => n.id)).size !== doc.nodes.length)
      fail(view, "Element identifiers must be unique.");
  }
  issues.push(
    ...validateTree(sections).issues.map((i) => ({ path: i.path || i.key, message: i.message }))
  );
  return { sections, issues };
}
