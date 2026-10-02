"use client";
import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EDITORIAL_COLLECTION, editorialConcept } from "@/lib/domain/editorialCollection";
import type { ActionResult } from "@/app/(admin)/admin/_lib/action-result";
import styles from "./EditorialCollectionGallery.module.css";

export function EditorialCollectionGallery({
  initialConcept,
  canCreatePage,
  canCreateArticle,
  createDraft,
}: {
  initialConcept?: string;
  canCreatePage: boolean;
  canCreateArticle: boolean;
  createDraft(input: unknown): Promise<ActionResult<{ path: string }>>;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [group, setGroup] = useState("all");
  const [limit, setLimit] = useState(18);
  const [selected, setSelected] = useState(
    initialConcept && editorialConcept(initialConcept) ? initialConcept : ""
  );
  const [view, setView] = useState("reference");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const concept = editorialConcept(selected);
  useEffect(() => {
    if (concept) {
      dialog.current?.showModal();
      setTitle(concept.name);
      setSlug("");
      setError("");
    } else dialog.current?.close();
  }, [concept]);
  const matches = EDITORIAL_COLLECTION.filter(
    (c) =>
      (kind === "all" || c.kind === kind) &&
      (group === "all" || c.group === group) &&
      `${c.id} ${c.name} ${c.group} ${c.description} ${c.references}`
        .toLowerCase()
        .includes(query.toLowerCase().trim())
  );
  const canCreate = concept?.kind === "article" ? canCreateArticle : canCreatePage;
  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <p>MODERN GENTLEMEN / DESIGN COLLECTION</p>
        <h1>Ninety ways to tell a story.</h1>
        <p>
          60 editorial sections. 30 complete article templates. Explore the approved concepts,
          compare their live layouts, and start a new draft.
        </p>
      </header>
      <div className={styles.filters}>
        <label>
          Search the collection
          <input
            type="search"
            value={query}
            placeholder="Number, title or subject…"
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(18);
            }}
          />
        </label>
        <label>
          Format
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setLimit(18);
            }}
          >
            <option value="all">All 90 designs</option>
            <option value="section">Sections 01–60</option>
            <option value="article">Articles 61–90</option>
          </select>
        </label>
        <label>
          Subject
          <select
            value={group}
            onChange={(e) => {
              setGroup(e.target.value);
              setLimit(18);
            }}
          >
            <option value="all">All subjects</option>
            {[...new Set(EDITORIAL_COLLECTION.map((c) => c.group))].map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
        </label>
      </div>
      <p role="status" aria-label="Collection results" className={styles.count}>
        {matches.length} {matches.length === 1 ? "design" : "designs"}
      </p>
      <div className={styles.grid}>
        {matches.slice(0, limit).map((c) => (
          <button
            type="button"
            className={styles.card}
            key={c.id}
            onClick={() => {
              setSelected(c.id);
              setView("reference");
            }}
          >
            <div className={styles.thumbnail}>
              <Image
                src={c.reference}
                width={480}
                height={c.kind === "article" ? 720 : 320}
                alt={`${c.name} approved concept`}
              />
            </div>
            <span className={styles.meta}>
              {c.id} / {c.kind === "article" ? "Article template" : c.group}
            </span>
            <strong>{c.name}</strong>
            <span>{c.description}</span>
            <span className={styles.explore}>Explore design ↗</span>
          </button>
        ))}
      </div>
      {!matches.length && <p>No designs match this search. Try another title or subject.</p>}
      {matches.length > limit && (
        <button className={styles.more} type="button" onClick={() => setLimit(limit + 18)}>
          Show more designs
        </button>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="collection-dialog-title"
        className={styles.dialog}
        onCancel={(e) => {
          if (pending) e.preventDefault();
          else setSelected("");
        }}
        onClose={() => setSelected("")}
      >
        {concept && (
          <>
            <header className={styles.dialogHeader}>
              <div>
                <span className={styles.meta}>
                  DESIGN {concept.id} / {concept.kind}
                </span>
                <h2 id="collection-dialog-title">{concept.name}</h2>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => setSelected("")}
                aria-label="Close design"
              >
                Close ×
              </button>
            </header>
            <div className={styles.tabs} role="group" aria-label="Preview mode">
              {["reference", "desktop", "mobile"].map((mode) => (
                <button
                  type="button"
                  key={mode}
                  aria-pressed={view === mode}
                  onClick={() => setView(mode)}
                >
                  {mode === "reference" ? "Approved mock-up" : `Live ${mode}`}
                </button>
              ))}
            </div>
            <div className={styles.preview}>
              {view === "reference" ? (
                <Image
                  src={concept.reference}
                  width={concept.kind === "article" ? 1024 : 1536}
                  height={concept.kind === "article" ? 1536 : 1024}
                  alt={`${concept.name} approved mock-up`}
                />
              ) : (
                <iframe
                  key={`${selected}-${view}`}
                  title={`${concept.name} live ${view} layout`}
                  src={`/editorial-preview/${concept.id}`}
                  style={{ width: view === "mobile" ? 390 : 1280 }}
                />
              )}
            </div>
            <div className={styles.detail}>
              <div>
                <p className={styles.meta}>DESIGN PRINCIPLES</p>
                <p>{concept.references}</p>
                <p className={styles.help}>
                  The live layout uses editable text, media and controls. Drafts start with a
                  writing structure; add your approved copy, images and destinations in the editor.
                </p>
                <a href={concept.reference} target="_blank" rel="noreferrer">
                  Open full mock-up ↗
                </a>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setError("");
                  startTransition(async () => {
                    try {
                      const result = await createDraft({ concept: concept.id, title, slug });
                      if (!result.ok) {
                        setError(result.error);
                        return;
                      }
                      router.push(result.data.path);
                    } catch {
                      setError("The draft could not be created. Please try again.");
                    }
                  });
                }}
              >
                <h3>
                  Start {concept.kind === "article" ? "an article" : "a page"} with this design
                </h3>
                <label>
                  Title
                  <input
                    required
                    maxLength={200}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={pending || !canCreate}
                  />
                </label>
                <label>
                  URL slug
                  <input
                    required
                    maxLength={120}
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    placeholder="your-story-title"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    disabled={pending || !canCreate}
                  />
                </label>
                <button type="submit" disabled={pending || !canCreate}>
                  {pending ? "Creating draft…" : "Use this design"}
                </button>
                {!canCreate && <p>You have read access to this collection.</p>}
                {error && <p role="alert">{error}</p>}
              </form>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
