"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  applyAppearanceChanges,
  appearanceTargets,
  type AppearanceChanges,
  type MegaAppearance,
} from "@/lib/blocks/appearanceCustomizer";
import { STUDIO_SOURCE_KEY } from "@/lib/blocks/studioPublishing";
import { MEGA_HOVER_ANIMATIONS } from "@/lib/blocks/studioFeatures";
import {
  FONT_PRESET_OPTIONS,
  TYPOGRAPHY_ROLES,
  HEADER_ENTRY_ANIMATIONS,
  type ThemeSettings,
  type ThemeHeader,
  type FontSelection,
} from "@/lib/domain/theme";
import { readPageSettings } from "@/lib/domain/pageSettings";
import type {
  loadAppearancePage,
  loadAppearanceTheme,
  listAppearancePages,
} from "@/lib/services/appearanceCustomizer";
import {
  loadPageAction,
  loadArticlePreviewAction,
  savePageAction,
  saveThemeAction,
  previewPageAction,
  publishAppearanceAction,
} from "@/app/(admin)/admin/customizer/actions";
import { ColorInput } from "./ui/Input";
import { Select } from "./ui/Select";
import { NumberInput } from "./ui/NumberInput";
import { Toggle } from "./ui/Toggle";
import { MediaOverlayEditor } from "./builder/MediaOverlayEditor";
import { GradientEditor } from "./builder/GradientEditor";
import type { AppearancePreviewState } from "./AppearancePreview";
import styles from "./AppearanceStudio.module.css";
import { SearchAppearanceControls } from "./SearchAppearanceControls";
import { ArticleDesignControls } from "./articles/ArticleDesignControls";

type Page = Awaited<ReturnType<typeof loadAppearancePage>>;
type Theme = Awaited<ReturnType<typeof loadAppearanceTheme>>;
type State = { theme: ThemeSettings; changes: AppearanceChanges };
const emptyChanges = (): AppearanceChanges => ({ targets: [] });
const options = (values: readonly string[]) =>
  values.map((value) => ({ value, label: value.replaceAll("-", " ") }));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function AppearanceStudio({
  initialPage,
  articleChoices = [],
  initialTheme,
  pages,
  permissions,
}: {
  initialPage: Page | null;
  articleChoices?: { slug: string; title: string }[];
  initialTheme: Theme;
  pages: Awaited<ReturnType<typeof listAppearancePages>>;
  permissions: {
    pageWrite: boolean;
    themeWrite: boolean;
    pagePublish: boolean;
    themePublish: boolean;
  };
}) {
  const [page, setPage] = useState(initialPage);
  const [savedTheme, setSavedTheme] = useState(initialTheme);
  const [history, setHistory] = useState<State[]>([
    { theme: initialTheme.settings, changes: emptyChanges() },
  ]);
  const [cursor, setCursor] = useState(0);
  const state = history[cursor];
  const [area, setArea] = useState("header");
  const [articleSlug, setArticleSlug] = useState(articleChoices[0]?.slug || "");
  const [articlePreview, setArticlePreview] = useState<AppearancePreviewState["article"]>();
  useEffect(() => {
    if (area !== "articles" || !articleSlug) return;
    let cancelled = false;
    void loadArticlePreviewAction(articleSlug)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setArticlePreview(result.data);
          setPreviewError("");
        } else setPreviewError(result.error);
      })
      .catch(() => {
        if (!cancelled) setPreviewError("The article preview could not load.");
      });
    return () => {
      cancelled = true;
    };
  }, [area, articleSlug]);
  const [targetId, setTargetId] = useState("");
  const [device, setDevice] = useState("1280");
  const [mode, setMode] = useState<"light" | "dark">("light");
  const [compare, setCompare] = useState(false);
  const [replay, setReplay] = useState(0);
  const [searchPreviewId, setSearchPreviewId] = useState(0);
  const [searchPreviewOpen, setSearchPreviewOpen] = useState(false);
  const [searchPreviewQuery, setSearchPreviewQuery] = useState("Watches");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [review, setReview] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [preview, setPreview] = useState<{
    current: Pick<AppearancePreviewState, "sections" | "pageSettings">;
    original: Pick<AppearancePreviewState, "sections" | "pageSettings">;
  } | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 700 });
  const pageDirty = !!state.changes.page || state.changes.targets.length > 0;
  const themeDirty = !same(state.theme, savedTheme.settings);
  const dirty = pageDirty || themeDirty;
  const global = area === "header" || area === "site" || area === "articles";
  const canWrite = global ? permissions.themeWrite : permissions.pageWrite;
  const width = Number(device),
    scale = Math.min(1, Math.max(0.1, (stageSize.width - 40) / width));
  const computed = useMemo(() => {
    if (!page) return { payload: null, error: "" };
    try {
      return { payload: applyAppearanceChanges(page.payload, state.changes), error: "" };
    } catch (e) {
      return {
        payload: page.payload,
        error: e instanceof Error ? e.message : "Invalid appearance settings.",
      };
    }
  }, [page, state.changes]);
  const targets = useMemo(
    () => (computed.payload ? appearanceTargets(computed.payload) : []),
    [computed.payload]
  );
  const choices = area === "mega" ? targets.filter((t) => t.mega) : targets;
  const target = choices.find((t) => t.id === targetId) || choices[0];
  const pageSettings = readPageSettings(computed.payload?.pageSettings);
  const patch = (next: State) => {
    setCompare(false);
    setHistory([...history.slice(0, cursor + 1), next].slice(-80));
    setCursor(Math.min(cursor + 1, 79));
    setMessage("");
    setError("");
  };
  const setHeader = (value: Partial<ThemeHeader>) => {
    if (!("search" in value)) setSearchPreviewOpen(false);
    patch({ ...state, theme: { ...state.theme, header: { ...state.theme.header, ...value } } });
  };
  const showSearchPreview = () => {
    setCompare(false);
    setSearchPreviewOpen(true);
    setSearchPreviewId((id) => id + 1);
  };
  const setPageAppearance = (value: NonNullable<AppearanceChanges["page"]>) =>
    patch({ ...state, changes: { ...state.changes, page: { ...state.changes.page, ...value } } });
  const setTarget = (value: Omit<AppearanceChanges["targets"][number], "id">) => {
    if (!target) return;
    const previous = state.changes.targets.find((p) => p.id === target.id);
    patch({
      ...state,
      changes: {
        ...state.changes,
        targets: [
          ...state.changes.targets.filter((p) => p.id !== target.id),
          { ...previous, ...value, id: target.id },
        ],
      },
    });
  };
  const setMega = (value: MegaAppearance) =>
    setTarget({
      mega: { ...state.changes.targets.find((t) => t.id === target?.id)?.mega, ...value },
    });
  useEffect(() => {
    if (!stage.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setStageSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    );
    observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const protect = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty]);
  useEffect(() => {
    if (!page || computed.error) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const input = { id: page.id, expectedUpdatedAt: page.updatedAt };
        const [current, original] = await Promise.all([
          previewPageAction({ ...input, changes: state.changes }),
          previewPageAction({ ...input, changes: emptyChanges() }),
        ]);
        if (cancelled) return;
        if (!current.ok) {
          setPreviewError(current.error);
          return;
        }
        if (!original.ok) {
          setPreviewError(original.error);
          return;
        }
        setPreview({ current: current.data, original: original.data });
        setPreviewError("");
      } catch {
        if (!cancelled) setPreviewError("Preview could not refresh. Your edits are still here.");
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [page, state.changes, computed.error]);
  const previewState = useMemo(
    () =>
      preview
        ? {
            ...(compare ? preview.original : preview.current),
            theme: compare ? savedTheme.settings : state.theme,
            mode,
            replay,
            searchPreview: {
              id: searchPreviewId,
              open: area === "header" && searchPreviewOpen,
              query: searchPreviewQuery,
            },
            article: area === "articles" ? articlePreview : undefined,
          }
        : null,
    [
      preview,
      compare,
      savedTheme.settings,
      state.theme,
      mode,
      replay,
      area,
      articlePreview,
      searchPreviewId,
      searchPreviewOpen,
      searchPreviewQuery,
    ]
  );
  useEffect(() => {
    const send = () => {
      if (previewState)
        frame.current?.contentWindow?.postMessage(
          { type: "mg:appearance", state: previewState },
          location.origin
        );
    };
    const ready = (e: MessageEvent) => {
      if (
        e.source === frame.current?.contentWindow &&
        e.origin === location.origin &&
        e.data?.type === "mg:appearance-mode" &&
        ["light", "dark"].includes(e.data.mode)
      )
        setMode(e.data.mode);
      if (
        e.source === frame.current?.contentWindow &&
        e.origin === location.origin &&
        e.data?.type === "mg:appearance-ready"
      )
        send();
    };
    window.addEventListener("message", ready);
    send();
    return () => window.removeEventListener("message", ready);
  }, [previewState]);
  const resetHistory = (next: State) => {
    setHistory([next]);
    setCursor(0);
  };
  async function choosePage(id: string) {
    setBusy(true);
    setError("");
    try {
      const result = await loadPageAction(id);
      if (!result.ok) throw new Error(result.error);
      setPage(result.data);
      setPreview(null);
      setTargetId("");
      resetHistory({ ...state, changes: emptyChanges() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open page.");
    } finally {
      setBusy(false);
    }
  }
  async function save(scope: "theme" | "page") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (scope === "theme") {
        const result = await saveThemeAction({
          expectedUpdatedAt: savedTheme.updatedAt,
          settings: state.theme,
        });
        if (!result.ok) throw new Error(result.error);
        setSavedTheme(result.data);
        resetHistory({ ...state, theme: result.data.settings });
      } else if (page) {
        const result = await savePageAction({
          id: page.id,
          expectedUpdatedAt: page.updatedAt,
          changes: state.changes,
        });
        if (!result.ok) throw new Error(result.error);
        setPage(result.data);
        resetHistory({ ...state, changes: emptyChanges() });
      }
      setMessage(
        `${scope === "theme" ? "Site theme" : "Page"} draft saved. Publish when you are ready.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed. Your edits are still here.");
    } finally {
      setBusy(false);
    }
  }
  async function publish(scope: "theme" | "page") {
    setBusy(true);
    setError("");
    try {
      const result = await publishAppearanceAction({
        scope,
        ...(scope === "page" ? { id: page?.id } : {}),
        expectedUpdatedAt: scope === "theme" ? savedTheme.updatedAt : page?.updatedAt,
      });
      if (!result.ok) throw new Error(result.error);
      // Publishing updates the row timestamp. Reload before the next edit.
      setMessage(
        `${scope === "theme" ? "Site theme" : "Page"} published. Reloading the saved settings…`
      );
      window.location.assign(`/admin/customizer${page ? `?id=${page.id}` : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Publishing failed.");
      setBusy(false);
    }
  }
  const h = state.theme.header;
  return (
    <section
      className={styles.studio}
      aria-label="Appearance Studio"
      onClickCapture={(e) => {
        if (
          dirty &&
          (e.target as Element).closest("a[href]") &&
          !window.confirm("Leave Appearance Studio and discard unsaved changes?")
        )
          e.preventDefault();
      }}
    >
      <header className={styles.top}>
        <Link href="/admin" className={styles.brand}>
          MG
          <span>
            APPEARANCE STUDIO<small>A different way to make it yours.</small>
          </span>
        </Link>
        <span className={styles.status}>{dirty ? "Unsaved changes" : "Saved draft"}</span>
        <button disabled={busy || cursor === 0} onClick={() => setCursor(cursor - 1)}>
          Undo
        </button>
        <button
          disabled={busy || cursor === history.length - 1}
          onClick={() => setCursor(cursor + 1)}
        >
          Redo
        </button>
        <button onClick={() => setReview(!review)} aria-expanded={review}>
          Review & publish
        </button>
        <button
          className={styles.primary}
          disabled={busy || !canWrite || (global ? !themeDirty : !pageDirty) || !!computed.error}
          onClick={() => void save(global ? "theme" : "page")}
        >
          Save {global ? "theme" : "page"} draft
        </button>
      </header>
      {(message || error || computed.error || previewError) && (
        <div
          className={styles.notice}
          role={error || computed.error || previewError ? "alert" : "status"}
        >
          {error || computed.error || previewError || message}
        </div>
      )}
      {review && (
        <div className={styles.review}>
          <div>
            <strong>Review changes</strong>
            <p>
              Theme settings affect the whole site. Page settings affect{" "}
              {page?.title || "the selected page"}. Publishing includes all changes already saved in
              that draft.
            </p>
          </div>
          <div>
            <strong>Site theme · {themeDirty ? "unsaved" : "saved draft"}</strong>
            <p>
              {themeDirty
                ? [
                    !same(state.theme.header, savedTheme.settings.header) && "Header",
                    !same(state.theme.colors, savedTheme.settings.colors) && "Colors",
                    !same(state.theme.articles, savedTheme.settings.articles) && "Article designs",
                    !same(state.theme.typography, savedTheme.settings.typography) && "Typography",
                  ]
                    .filter(Boolean)
                    .join(", ")
                : "Ready to review in the preview."}
            </p>
            <button
              disabled={busy || !permissions.themeWrite || !themeDirty}
              onClick={() => void save("theme")}
            >
              Save theme draft
            </button>
            <button
              disabled={busy || dirty || !permissions.themePublish}
              onClick={() => void publish("theme")}
            >
              Publish site theme
            </button>
          </div>
          <div>
            <strong>
              {page?.title || "Page"} · {pageDirty ? "unsaved" : "saved draft"}
            </strong>
            <p>
              {state.changes.page ? "Page appearance. " : ""}
              {state.changes.targets
                .map((t) => targets.find((target) => target.id === t.id)?.label || t.id)
                .join(", ") || "No section changes in this session."}
            </p>
            <button
              disabled={busy || !permissions.pageWrite || !pageDirty || !!computed.error}
              onClick={() => void save("page")}
            >
              Save page draft
            </button>
            <button
              disabled={busy || dirty || !page || !permissions.pagePublish}
              onClick={() => void publish("page")}
            >
              Publish page
            </button>
          </div>
        </div>
      )}
      <div className={styles.workspace}>
        <nav className={styles.rail} aria-label="Customization areas">
          <small>SITE-WIDE</small>
          {[
            ["site", "Site styles", "Colors & typography"],
            ["header", "Header", "Surface & motion"],
            ["articles", "Articles", "Designs & featured media"],
            ["page", "Page appearance", "Background & chrome"],
            ["mega", "Mega menu", "Categories & stories"],
            ["media", "Media overlays", "Color & gradients"],
          ].map(([id, title, sub], i) => (
            <div key={id}>
              {i === 3 && <small>THIS PAGE</small>}
              <button
                aria-current={area === id ? "page" : undefined}
                onClick={() => {
                  setArea(id);
                  setTargetId("");
                }}
              >
                <strong>{title}</strong>
                <span>{sub}</span>
              </button>
            </div>
          ))}
          <div className={styles.other}>
            <small>CONTINUE EDITING</small>
            <Link
              href={
                page?.payload[STUDIO_SOURCE_KEY]
                  ? `/admin/design-studio?id=${page.id}`
                  : page
                    ? `/admin/pages/${page.id}`
                    : "/admin/pages"
              }
            >
              Open page builder ↗
            </Link>
            <Link href="/admin/theme">Open theme editor ↗</Link>
          </div>
        </nav>
        <div className={styles.previewColumn}>
          <div className={styles.toolbar}>
            <Select
              label="Preview page"
              value={page?.id || ""}
              disabled={busy || pageDirty}
              options={pages.map((p) => ({ value: p.id, label: p.title }))}
              onChange={(id) => void choosePage(id)}
            />
            <Select
              label="Viewport"
              value={device}
              options={[
                { value: "1280", label: "Desktop · 1280" },
                { value: "800", label: "Tablet · 800" },
                { value: "390", label: "Mobile · 390" },
              ]}
              onChange={setDevice}
            />
            <button onClick={() => setMode(mode === "light" ? "dark" : "light")}>
              {mode === "light" ? "Dark" : "Light"} preview
            </button>
            <button aria-pressed={compare} onClick={() => setCompare(!compare)}>
              {compare ? "Show changes" : "Compare saved"}
            </button>
          </div>
          <div className={styles.stage} ref={stage}>
            {page ? (
              <div style={{ width: width * scale, height: Math.max(320, stageSize.height - 40) }}>
                <iframe
                  ref={frame}
                  title="Live appearance preview"
                  src="/admin/customizer-preview"
                  style={{
                    width,
                    height: Math.max(320, stageSize.height - 40) / scale,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                  }}
                />
              </div>
            ) : (
              <p>Create a page in either builder to start previewing.</p>
            )}
          </div>
          <div className={styles.caption}>
            {compare ? "Saved draft comparison" : "Draft preview"} · {device}px viewport ·{" "}
            {Math.round(scale * 100)}% fit
            {pageDirty ? " · Save the page draft before switching pages" : ""}
          </div>
        </div>
        <aside className={styles.controls}>
          <small>{global ? "SITE-WIDE SETTINGS" : page?.title || "PAGE SETTINGS"}</small>
          <h1>
            {
              {
                site: "Site styles",
                header: "Header",
                articles: "Article designs",
                page: "Page appearance",
                mega: "Mega menu",
                media: "Media overlays",
              }[area]
            }
          </h1>
          <p className={styles.hint}>
            {global ? "One shared design across the site." : "Appearance settings for this page."}
          </p>
          <fieldset disabled={busy || !canWrite || (!global && !page)} className={styles.fields}>
            {area === "site" && (
              <>
                <ColorInput
                  label="Accent color"
                  value={state.theme.colors.dark?.accent || "#c8102e"}
                  onChange={(accent) =>
                    patch({
                      ...state,
                      theme: {
                        ...state.theme,
                        colors: {
                          ...state.theme.colors,
                          dark: { ...state.theme.colors.dark, accent },
                        },
                      },
                    })
                  }
                />
                {(["light", "dark"] as const).map((context) => (
                  <div key={context}>
                    <h2>{context} palette</h2>
                    {(["bg", "fg", "surface", "accentInk"] as const).map((token) => (
                      <ColorInput
                        key={token}
                        label={`${context} ${token === "bg" ? "background" : token === "fg" ? "text" : token}`}
                        value={state.theme.colors[context]?.[token] || ""}
                        onChange={(value) =>
                          patch({
                            ...state,
                            theme: {
                              ...state.theme,
                              colors: {
                                ...state.theme.colors,
                                [context]: { ...state.theme.colors[context], [token]: value },
                              },
                            },
                          })
                        }
                      />
                    ))}
                  </div>
                ))}
                <h2>Typography</h2>
                {TYPOGRAPHY_ROLES.map((role) => (
                  <Select
                    key={role}
                    label={`${role} font`}
                    value={state.theme.typography[role]}
                    options={[
                      ...FONT_PRESET_OPTIONS,
                      ...state.theme.typography.webfonts.map((font) => ({
                        value: `webfont:${font.id}`,
                        label: font.label,
                      })),
                    ]}
                    onChange={(font) =>
                      patch({
                        ...state,
                        theme: {
                          ...state.theme,
                          typography: { ...state.theme.typography, [role]: font as FontSelection },
                        },
                      })
                    }
                  />
                ))}
                <NumberInput
                  label="Base font size"
                  min={14}
                  max={20}
                  value={state.theme.typography.baseSize}
                  onChange={(v) =>
                    v !== undefined &&
                    patch({
                      ...state,
                      theme: {
                        ...state.theme,
                        typography: { ...state.theme.typography, baseSize: v },
                      },
                    })
                  }
                />
              </>
            )}
            {area === "header" && (
              <>
                <Select
                  label="Header surface"
                  value={h.background}
                  options={[
                    { value: "dynamic", label: "Dynamic" },
                    { value: "solid", label: "Frosted" },
                    { value: "transparent", label: "Transparent" },
                    { value: "filled", label: "Solid color" },
                  ]}
                  onChange={(background) =>
                    setHeader({ background: background as ThemeHeader["background"] })
                  }
                />
                <ColorInput
                  label="Header color"
                  value={h.fillColor}
                  onChange={(fillColor) => setHeader({ fillColor })}
                />
                {(
                  [
                    ["fillOpacity", "Opacity · %", 0, 100],
                    ["frostBlur", "Background frost · px", 0, 60],
                    ["frostSaturation", "Background saturation · %", 0, 200],
                    ["height", "Header height · px", 56, 96],
                  ] as const
                ).map(([key, label, min, max]) => (
                  <NumberInput
                    key={key}
                    label={label}
                    value={h[key]}
                    min={min}
                    max={max}
                    onChange={(v) => v !== undefined && setHeader({ [key]: v })}
                  />
                ))}
                <Toggle
                  label="Adapt to light backgrounds"
                  checked={h.autoContrast}
                  onChange={(autoContrast) => setHeader({ autoContrast })}
                  help="Automatically adjust header elements on transparent and frosted surfaces."
                />
                <h2>Entry animation</h2>
                <Select
                  label="Entry effect"
                  value={h.entryAnimation}
                  options={options(HEADER_ENTRY_ANIMATIONS)}
                  onChange={(entryAnimation) =>
                    setHeader({ entryAnimation: entryAnimation as ThemeHeader["entryAnimation"] })
                  }
                />
                <NumberInput
                  label="Entry duration · ms"
                  min={80}
                  max={2000}
                  value={h.entryDuration}
                  onChange={(v) => v !== undefined && setHeader({ entryDuration: v })}
                />
                <button
                  onClick={() => {
                    setSearchPreviewOpen(false);
                    setReplay(replay + 1);
                  }}
                >
                  Replay animation
                </button>
                <Toggle
                  label="Show search"
                  checked={h.showSearch}
                  onChange={(showSearch) => setHeader({ showSearch })}
                />
                <Toggle
                  label="Show theme toggle"
                  checked={h.showThemeToggle}
                  onChange={(showThemeToggle) => setHeader({ showThemeToggle })}
                />
                <SearchAppearanceControls
                  value={h.search}
                  onChange={(search) => {
                    setHeader({ search });
                    showSearchPreview();
                  }}
                  onPreview={showSearchPreview}
                  previewQuery={searchPreviewQuery}
                  onPreviewQueryChange={setSearchPreviewQuery}
                />
                <p className={styles.hint}>
                  Separate mobile header settings and navigation remain available in the theme
                  editor.
                </p>
              </>
            )}
            {area === "articles" && (
              <>
                <Select
                  label="Article to preview"
                  value={articleSlug}
                  options={articleChoices.map((a) => ({ value: a.slug, label: a.title }))}
                  onChange={setArticleSlug}
                />
                <ArticleDesignControls
                  value={state.theme.articles}
                  onChange={(articles) => patch({ ...state, theme: { ...state.theme, articles } })}
                />
                <Link href="/admin/articles" className="block py-3 text-xs underline">
                  Open articles to choose a design and featured media
                </Link>
              </>
            )}
            {area === "page" && (
              <>
                <ColorInput
                  label="Page background"
                  value={pageSettings.backgroundColor || ""}
                  onChange={(backgroundColor) => setPageAppearance({ backgroundColor })}
                />
                <GradientEditor
                  value={pageSettings.backgroundGradient}
                  onPreview={() => {}}
                  onChange={(backgroundGradient) => setPageAppearance({ backgroundGradient })}
                />
                {(["header", "mobileHeader", "footer", "mobileFooter"] as const).map((key) => (
                  <Select
                    key={key}
                    label={key.replace("mobile", "Mobile ")}
                    value={pageSettings[key] || "inherit"}
                    options={options(
                      key.toLowerCase().includes("header")
                        ? ["inherit", "hidden", "overlay"]
                        : ["inherit", "hidden"]
                    )}
                    onChange={(value) => setPageAppearance({ [key]: value })}
                  />
                ))}
                <MediaOverlayEditor
                  label="Page background overlay"
                  value={pageSettings.mediaOverlay}
                  onChange={(mediaOverlay) => setPageAppearance({ mediaOverlay })}
                />
                <p className={styles.hint}>
                  Page overlays appear over the page background image or video. Section media has
                  its own overlay below.
                </p>
              </>
            )}
            {(area === "mega" || area === "media") && (
              <>
                {choices.length ? (
                  <>
                    <Select
                      label="Edit section"
                      value={target?.id || ""}
                      options={choices.map((t) => ({ value: t.id, label: t.label }))}
                      onChange={setTargetId}
                    />
                    {area === "mega" && target?.mega ? (
                      <>
                        <ColorInput
                          label="Category hover color"
                          value={target.mega.hoverColor || target.mega.accent || "#c8102e"}
                          onChange={(hoverColor) => setMega({ hoverColor })}
                        />
                        <ColorInput
                          label="Menu accent"
                          value={target.mega.accent || "#c8102e"}
                          onChange={(accent) => setMega({ accent })}
                        />
                        <Toggle
                          label="Show story images in color"
                          checked={!!target.mega.imageColor}
                          onChange={(imageColor) => setMega({ imageColor })}
                        />
                        <Toggle
                          label="Match site accent for labels and title hover"
                          checked={target.mega.matchPageAccent !== false}
                          onChange={(matchPageAccent) => setMega({ matchPageAccent })}
                        />
                        <Select
                          label="Category hover animation"
                          value={target.mega.hoverAnimation || "slide"}
                          options={options(MEGA_HOVER_ANIMATIONS)}
                          onChange={(hoverAnimation) =>
                            setMega({
                              hoverAnimation: hoverAnimation as MegaAppearance["hoverAnimation"],
                            })
                          }
                        />
                        <Select
                          label="Story transition"
                          value={target.mega.storyAnimation || "rise"}
                          options={options(["rise", "fade", "slide", "none"])}
                          onChange={(storyAnimation) =>
                            setMega({
                              storyAnimation: storyAnimation as MegaAppearance["storyAnimation"],
                            })
                          }
                        />
                        <NumberInput
                          label="Transition duration · ms"
                          min={80}
                          max={800}
                          value={target.mega.animationDuration ?? 220}
                          onChange={(v) => v !== undefined && setMega({ animationDuration: v })}
                        />
                      </>
                    ) : (
                      <MediaOverlayEditor
                        value={target?.overlay}
                        onChange={(overlay) => setTarget({ overlay })}
                      />
                    )}
                  </>
                ) : (
                  <p className={styles.hint}>
                    {area === "mega"
                      ? "This page has no mega menu. Add one in Design Studio to customize it here."
                      : "This page has no editable media sections."}
                  </p>
                )}
                <p className={styles.hint}>
                  Design Studio appearances follow matching sections across desktop, tablet and
                  mobile. Shared patterns are edited in the pattern editor.
                </p>
              </>
            )}
          </fieldset>
          {!canWrite && (
            <p className={styles.hint}>
              Your role can preview these settings but cannot save changes.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
