import type { BlockNode, BlockTree } from "./types";
import type { VisualElementDesign } from "./visual";

/**
 * The builder engine's normalized component graph.
 *
 * Version-one elements deliberately keep the existing section registry as the
 * rendering primitive. That makes the transition reversible: every live page
 * can move into the engine, gain responsive visual data, and move back without
 * losing a legacy field. Later native text/image primitives can be introduced
 * beside `component` after they can reproduce the corresponding sections.
 */
export const BUILDER_ENGINE_VERSION = 1;

export interface BuilderEngineElement {
  id: string;
  kind: "component";
  component: string;
  settings?: Record<string, unknown>;
  visual?: VisualElementDesign;
  legacy: Record<string, unknown>;
  children: BuilderEngineElement[];
}

export interface BuilderEngineDocument {
  engineVersion: typeof BUILDER_ENGINE_VERSION;
  elements: BuilderEngineElement[];
}

const STRUCTURAL_KEYS = new Set([
  "_key",
  "_type",
  "_ref",
  "settings",
  "children",
  "visibility",
  "design",
  "visual",
  "locked",
]);

function blockToElement(node: BlockNode): BuilderEngineElement {
  const legacy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (!STRUCTURAL_KEYS.has(key)) legacy[key] = value;
  }

  if (node._ref !== undefined) legacy._ref = node._ref;
  if (node.visibility !== undefined) legacy.visibility = node.visibility;
  if (node.design !== undefined) legacy.design = node.design;
  if (node.locked !== undefined) legacy.locked = node.locked;

  return {
    id: node._key,
    kind: "component",
    component: node._type,
    settings: node.settings,
    visual: node.visual,
    legacy,
    children: (node.children ?? []).map(blockToElement),
  };
}

function elementToBlock(element: BuilderEngineElement): BlockNode {
  const { _ref, visibility, design, locked, ...flatProps } = element.legacy;
  const node: BlockNode = {
    ...flatProps,
    _key: element.id,
    _type: element.component,
  };
  if (element.settings !== undefined) node.settings = element.settings;
  if (element.visual !== undefined) node.visual = element.visual;
  if (_ref !== undefined) node._ref = String(_ref);
  if (visibility !== undefined) node.visibility = visibility as BlockNode["visibility"];
  if (design !== undefined) node.design = design as BlockNode["design"];
  if (locked !== undefined) node.locked = locked === true;
  if (element.children.length > 0) node.children = element.children.map(elementToBlock);
  return node;
}

export function blockTreeToEngine(tree: BlockTree): BuilderEngineDocument {
  return {
    engineVersion: BUILDER_ENGINE_VERSION,
    elements: tree.map(blockToElement),
  };
}

export function engineToBlockTree(document: BuilderEngineDocument): BlockTree {
  return document.elements.map(elementToBlock);
}
