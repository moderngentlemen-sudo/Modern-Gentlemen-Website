/**
 * Version marker for persisted builder payloads.
 *
 * Documents written before the visual builder had an explicit version are
 * version 0 and remain readable. New saves are stamped with the current
 * version without rewriting their tree. Future schema changes can therefore
 * migrate on read and publish immutable snapshots without guessing which
 * document shape arrived.
 */
export const BUILDER_META_KEY = "_builder";
export const CURRENT_BUILDER_SCHEMA_VERSION = 2;

export interface BuilderMetadata {
  schemaVersion: number;
}

export function builderSchemaVersion(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  const metadata = (payload as Record<string, unknown>)[BUILDER_META_KEY];
  if (!metadata || typeof metadata !== "object") return 0;
  const version = (metadata as Record<string, unknown>).schemaVersion;
  return typeof version === "number" && Number.isInteger(version) && version >= 0 ? version : 0;
}

export function stampBuilderPayload(
  payload: Record<string, unknown>
): Record<string, unknown> & { _builder: BuilderMetadata } {
  const previous = payload[BUILDER_META_KEY];
  const metadata = previous && typeof previous === "object" ? previous : {};

  return {
    ...payload,
    [BUILDER_META_KEY]: {
      ...(metadata as Record<string, unknown>),
      schemaVersion: CURRENT_BUILDER_SCHEMA_VERSION,
    },
  } as Record<string, unknown> & { _builder: BuilderMetadata };
}
