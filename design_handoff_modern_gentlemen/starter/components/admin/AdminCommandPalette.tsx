"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "@/components/ui/clsx";
import { Dialog } from "./ui/Dialog";
import { FOCUS_RING, LABEL_SM } from "./ui/styles";

export interface AdminCommand {
  href: string;
  label: string;
  keywords?: string[];
}

function searchable(command: AdminCommand): string {
  return [command.label, command.href, ...(command.keywords ?? [])].join(" ").toLowerCase();
}

export function AdminCommandPalette({ commands }: { commands: AdminCommand[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return commands;
    return commands.filter((command) => {
      const haystack = searchable(command);
      return terms.every((term) => haystack.includes(term));
    });
  }, [commands, query]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (activeIndex >= results.length) setActiveIndex(Math.max(0, results.length - 1));
  }, [activeIndex, results.length]);

  const close = () => setOpen(false);
  const run = (command: AdminCommand) => {
    close();
    router.push(command.href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Control+K Meta+K"
        className={clsx(
          "mx-3 mb-2 flex w-[calc(100%-1.5rem)] items-center justify-between border border-mg-bd/25 px-2.5 py-2 text-left text-[12px] text-mg-fg/60 hover:border-mg-fg/50 hover:text-mg-fg",
          FOCUS_RING
        )}
      >
        <span>Search admin</span>
        <kbd className="font-mono text-[9px] uppercase tracking-[0.08em]">Ctrl K</kbd>
      </button>

      <Dialog
        open={open}
        onClose={close}
        title="Search admin"
        description="Jump to any module available to your account."
      >
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((index) => Math.min(index + 1, results.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((index) => Math.max(index - 1, 0));
            } else if (event.key === "Enter" && results[activeIndex]) {
              event.preventDefault();
              run(results[activeIndex]);
            }
          }}
          placeholder="Search pages, content, design…"
          aria-label="Search admin commands"
          aria-controls="admin-command-results"
          aria-activedescendant={results[activeIndex] ? `admin-command-${activeIndex}` : undefined}
          className={clsx(
            "w-full border border-mg-bd/30 bg-transparent px-3 py-2.5 text-[14px] outline-none placeholder:text-mg-fg/35 focus:border-mg-accent",
            FOCUS_RING
          )}
        />

        <div
          id="admin-command-results"
          role="listbox"
          aria-label="Admin destinations"
          className="mt-3 max-h-[360px] overflow-y-auto"
        >
          {results.map((command, index) => (
            <button
              id={`admin-command-${index}`}
              key={command.href}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseMove={() => setActiveIndex(index)}
              onClick={() => run(command)}
              className={clsx(
                "flex w-full items-center justify-between px-3 py-2.5 text-left text-[13px]",
                index === activeIndex ? "bg-mg-fg/7 text-mg-fg" : "text-mg-fg/65 hover:bg-mg-fg/5"
              )}
            >
              <span>{command.label}</span>
              <span className={LABEL_SM}>{command.href.replace("/admin", "") || "/"}</span>
            </button>
          ))}
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-[13px] text-mg-fg/50">
              No available destination matches “{query}”.
            </p>
          )}
        </div>
      </Dialog>
    </>
  );
}
