import { useEffect, useState } from "react";
import { hydrateSources } from "./store/assets";
import { loadAll, openDoc, ui, useStudio } from "./store/editor";
import { go, parseRoute, usePath } from "./router";
import { Home } from "./screens/Home";
import { Landing } from "./screens/Landing";
import { Editor } from "./screens/Editor";
import { DigitalCard } from "./screens/DigitalCard";
import { InstallDialog } from "./dialogs/InstallDialog";
import { SettingsDialog } from "./dialogs/SettingsDialog";
import { CropDialog } from "./dialogs/CropDialog";
import { BrandDialog } from "./dialogs/BrandDialog";
import { WizardDialog } from "./dialogs/WizardDialog";
import { SaveTemplateDialog } from "./ui/MoreMenu";
import { HistoryDialog } from "./dialogs/HistoryDialog";
import { BannerDialog } from "./dialogs/BannerDialog";
import { AccountDialog, DeleteAccountDialog } from "./ui/Account";
import { slugFromPath } from "./core/cardSlug";
import { Toasts } from "./ui/kit";

const cardToken = new URLSearchParams(location.search).get("card");
const cardSlug = slugFromPath(location.pathname);

function Studio() {
  const [ready, setReady] = useState(false);
  const route = parseRoute(usePath());
  const doc = useStudio((s) => s.doc);
  const docs = useStudio((s) => s.docs);
  const brandLogo = useStudio((s) => s.prefs.brand?.logo?.id);

  useEffect(() => {
    void loadAll().finally(() => setReady(true));
  }, []);

  // Keep the open signature in step with the address bar (back/forward, reloads, shared links).
  useEffect(() => {
    if (!ready) return;
    if (route.page === "editor") {
      const st = useStudio.getState();
      if (st.doc?.id === route.id && st.view === "editor") return;
      const found = st.docs.find((d) => d.id === route.id);
      if (found) openDoc(found, undefined, false);
      else go("/app", { replace: true });
    } else if (useStudio.getState().view === "editor") ui({ view: "home", dialog: null, selected: null });
  }, [ready, route.page, route.page === "editor" ? route.id : ""]);

  // Make uploaded images available to previews (object URLs from IndexedDB).
  useEffect(() => {
    const ids = new Set<string>();
    for (const d of doc ? [doc, ...docs] : docs) for (const id of Object.keys(d.assets)) ids.add(id);
    if (brandLogo) ids.add(brandLogo);
    if (ids.size) void hydrateSources([...ids]);
  }, [doc?.assets, docs, brandLogo]);

  if (!ready) return null;
  const editing = route.page === "editor" && doc && doc.id === route.id;
  return (
    <>
      {editing ? <Editor /> : route.page === "landing" ? <Landing /> : <Home />}
      <InstallDialog />
      <SettingsDialog />
      <CropDialog />
      <BrandDialog />
      <WizardDialog />
      <SaveTemplateDialog />
      <HistoryDialog />
      <BannerDialog />
      <AccountDialog />
      <DeleteAccountDialog />
      <Toasts />
    </>
  );
}

export function App() {
  if (cardToken) return <DigitalCard token={cardToken} />;
  if (cardSlug) return <DigitalCard slug={cardSlug} />;
  return <Studio />;
}
