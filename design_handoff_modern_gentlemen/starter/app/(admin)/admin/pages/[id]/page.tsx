import { loadPageEditor } from "./loadEditor";

export default function BuilderPage(props: { params: Promise<{ id: string }> }) {
  return loadPageEditor(props);
}
