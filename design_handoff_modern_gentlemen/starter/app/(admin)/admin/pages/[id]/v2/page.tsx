import { loadPageEditor } from "../loadEditor";

/** Reuses the same permission-checked document loader and server actions. */
export default function BuilderV2Page(props: { params: Promise<{ id: string }> }) {
  return loadPageEditor({ ...props, editor: "v2" });
}
