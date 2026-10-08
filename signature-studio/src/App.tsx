import { useEffect, useState } from "react";
import { hydrateSources } from "./store/assets";
import { loadAll, useStudio } from "./store/editor";
import { Home } from "./screens/Home";
import { Editor } from "./screens/Editor";
import { DigitalCard } from "./screens/DigitalCard";
import { InstallDialog } from "./dialogs/InstallDialog";
import { SettingsDialog } from "./dialogs/SettingsDialog";
import { CropDialog } from "./dialogs/CropDialog";
import { Toasts } from "./ui/kit";

const cardToken = new URLSearchParams(location.search).get("card");

function Studio() {
  const [ready, setReady] = useState(false);
  const view = useStudio((s) => s.view);
  const doc = useStudio((s) => s.doc);
  const docs = useStudio((s) => s.docs);

  useEffect(() => {
    void loadAll().finally(() => setReady(true));
  }, []);

  // Make uploaded images available to previews (object URLs from IndexedDB).
  useEffect(() => {
    const ids = new Set<string>();
    for (const d of doc ? [doc, ...docs] : docs) for (const id of Object.keys(d.assets)) ids.add(id);
    if (ids.size) void hydrateSources([...ids]);
  }, [doc?.assets, docs]);

  if (!ready) return null;
  return (
    <>
      {view === "editor" && doc ? <Editor /> : <Home />}
      <InstallDialog />
      <SettingsDialog />
      <CropDialog />
      <Toasts />
    </>
  );
}

export function App() {
  return cardToken ? <DigitalCard token={cardToken} /> : <Studio />;
}
