import { z } from "zod";
import { mediaOverlaySchema, type MediaOverlay } from "@/lib/domain/mediaOverlay";
import { pageSettingsSchema } from "@/lib/domain/pageSettings";
import { convertStudio, studioSourceSchema, STUDIO_SOURCE_KEY } from "./studioPublishing";
import { MEGA_HOVER_ANIMATIONS } from "./studioFeatures";
import type { BlockNode } from "./types";

const megaPatchSchema = z
  .object({
    hoverColor: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    accent: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i)
      .optional(),
    imageColor: z.boolean().optional(),
    matchPageAccent: z.boolean().optional(),
    hoverAnimation: z.enum(MEGA_HOVER_ANIMATIONS).optional(),
    storyAnimation: z.enum(["rise", "fade", "slide", "none"]).optional(),
    animationDuration: z.number().min(80).max(800).optional(),
  })
  .strict();
export type MegaAppearance = z.infer<typeof megaPatchSchema>;
export const pageAppearanceSchema = pageSettingsSchema
  .pick({
    backgroundColor: true,
    backgroundGradient: true,
    mediaOverlay: true,
    header: true,
    mobileHeader: true,
    footer: true,
    mobileFooter: true,
  })
  .strict();
export const appearanceChangesSchema = z
  .object({
    page: pageAppearanceSchema.optional(),
    targets: z
      .array(
        z
          .object({
            id: z.string().max(250),
            overlay: mediaOverlaySchema.optional(),
            mega: megaPatchSchema.optional(),
          })
          .strict()
      )
      .max(500),
  })
  .strict();
export type AppearanceChanges = z.infer<typeof appearanceChangesSchema>;
export type AppearancePayload = Record<string, unknown> & { sections: BlockNode[] };
export type AppearanceTarget = {
  id: string;
  label: string;
  overlay?: MediaOverlay;
  mega?: MegaAppearance;
};
type RecordValue = Record<string, unknown>;
const record = (v: unknown): RecordValue =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as RecordValue) : {};

/** Targets are derived from persisted identities, never client supplied object paths. */
function visitTargets(
  payload: AppearancePayload,
  visit: (
    target: AppearanceTarget,
    set: (patch: AppearanceChanges["targets"][number]) => void
  ) => void
) {
  const native = payload[STUDIO_SOURCE_KEY];
  if (native) {
    const source = studioSourceSchema.parse(native);
    payload[STUDIO_SOURCE_KEY] = source;
    const documents = [source.source, ...Object.values(source.views)];
    const seen = new Set<string>();
    for (const doc of documents) {
      for (const [index, section] of doc.sections.entries()) {
        const id = `section:${section.uid}`;
        if (seen.has(id)) continue;
        seen.add(id);
        visit(
          {
            id,
            label: `Section ${index + 1}${section.megaMenu ? " · Mega menu" : ""}`,
            overlay: section.overlay as MediaOverlay | undefined,
            mega: section.megaMenu ? (record(section.megaMenu) as MegaAppearance) : undefined,
          },
          (patch) => {
            for (const version of documents)
              for (const s of version.sections.filter((s) => s.uid === section.uid)) {
                if (patch.overlay) s.overlay = patch.overlay;
                if (patch.mega && s.megaMenu) s.megaMenu = { ...record(s.megaMenu), ...patch.mega };
              }
          }
        );
        if (section.megaMenu)
          visit(
            {
              id: `stories:${section.uid}`,
              label: `Section ${index + 1} · Story images`,
              overlay: record(section.megaMenu).imageOverlay as MediaOverlay | undefined,
            },
            (patch) => {
              for (const version of documents)
                for (const s of version.sections.filter((s) => s.uid === section.uid && s.megaMenu))
                  s.megaMenu = { ...record(s.megaMenu), imageOverlay: patch.overlay };
            }
          );
      }
      for (const node of doc.nodes.filter((n) => n.kind === "media")) {
        const id = `media:${node.id}`;
        if (seen.has(id)) continue;
        seen.add(id);
        visit(
          { id, label: `Media ${node.id}`, overlay: node.overlay as MediaOverlay | undefined },
          (patch) => {
            for (const version of documents)
              for (const n of version.nodes.filter((n) => n.id === node.id && n.kind === "media"))
                if (patch.overlay) n.overlay = patch.overlay;
          }
        );
      }
    }
    return;
  }
  function walk(nodes: BlockNode[]) {
    for (const node of nodes) {
      if (node._ref) continue; // Shared patterns remain owned by their pattern editor.
      const settings = node.settings || node;
      const direct = node._type === "studioCanvas" || node._type === "studioElement";
      visit(
        {
          id: `block:${node._key}`,
          label: `${node._type} · ${node._key}`,
          overlay: (direct ? settings.overlay : node.design?.mediaOverlay) as
            MediaOverlay | undefined,
          mega: settings.megaMenu ? (record(settings.megaMenu) as MegaAppearance) : undefined,
        },
        (patch) => {
          if (patch.overlay) {
            if (direct) settings.overlay = patch.overlay;
            else node.design = { ...node.design, mediaOverlay: patch.overlay };
          }
          if (patch.mega) settings.megaMenu = { ...record(settings.megaMenu), ...patch.mega };
        }
      );
      if (settings.megaMenu)
        visit(
          {
            id: `stories:${node._key}`,
            label: `${node._key} · Story images`,
            overlay: record(settings.megaMenu).imageOverlay as MediaOverlay | undefined,
          },
          (patch) => {
            settings.megaMenu = { ...record(settings.megaMenu), imageOverlay: patch.overlay };
          }
        );
      if (node.design?.background)
        visit(
          {
            id: `background:${node._key}`,
            label: `${node._key} · Section background`,
            overlay: node.design.background.mediaOverlay,
          },
          (patch) => {
            node.design = {
              ...node.design,
              background: { ...node.design?.background, mediaOverlay: patch.overlay },
            };
          }
        );
      if (node.children) walk(node.children);
    }
  }
  walk(payload.sections);
}
export function appearanceTargets(payload: AppearancePayload): AppearanceTarget[] {
  const targets: AppearanceTarget[] = [];
  visitTargets(structuredClone(payload), (target) => targets.push(target));
  return targets;
}
export function applyAppearanceChanges(
  payload: AppearancePayload,
  input: unknown
): AppearancePayload {
  const changes = appearanceChangesSchema.parse(input);
  const next = structuredClone(payload);
  const patches = new Map(changes.targets.map((p) => [p.id, p]));
  if (patches.size !== changes.targets.length) throw new Error("Duplicate appearance target.");
  visitTargets(next, (target, set) => {
    const patch = patches.get(target.id);
    if (!patch) return;
    if (patch.mega && !target.mega) throw new Error("This target has no mega menu.");
    set(patch);
    patches.delete(target.id);
  });
  if (patches.size) throw new Error("A selected section no longer exists. Reopen the page.");
  if (changes.page) next.pageSettings = { ...record(next.pageSettings), ...changes.page };
  if (next[STUDIO_SOURCE_KEY]) {
    const converted = convertStudio(studioSourceSchema.parse(next[STUDIO_SOURCE_KEY]));
    if (converted.issues.length)
      throw new Error(
        converted.issues
          .map((i) => i.message)
          .slice(0, 3)
          .join(" ")
      );
    next.sections = converted.sections;
  }
  return next;
}
