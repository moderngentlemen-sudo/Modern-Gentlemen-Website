import { Fragment, type ReactNode } from "react";

import { clsx } from "./clsx";

const INLINE_TOKEN = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[[^\]\n]+\]\([^)\s]+\)|\*[^*\n]+\*)/g;

function safeHref(value: string): string | undefined {
  const href = value.trim();
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (href.startsWith("#")) return href;
  if (/^(https?:|mailto:)/i.test(href)) return href;
  return undefined;
}

function inlineContent(value: string): ReactNode[] {
  return value
    .split(INLINE_TOKEN)
    .filter(Boolean)
    .map((token, index) => {
      const key = `${index}-${token}`;

      if (token.startsWith("**") && token.endsWith("**")) {
        return <strong key={key}>{token.slice(2, -2)}</strong>;
      }
      if (token.startsWith("*") && token.endsWith("*")) {
        return <em key={key}>{token.slice(1, -1)}</em>;
      }
      if (token.startsWith("`") && token.endsWith("`")) {
        return (
          <code key={key} className="bg-mg-fg/5 px-1 font-mono text-[0.9em]">
            {token.slice(1, -1)}
          </code>
        );
      }

      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) {
        const href = safeHref(link[2]);
        if (!href) return <Fragment key={key}>{link[1]}</Fragment>;
        const external = /^https?:/i.test(href);
        return (
          <a
            key={key}
            href={href}
            className="mg-underline"
            rel={external ? "noopener noreferrer" : undefined}
          >
            {link[1]}
          </a>
        );
      }

      return <Fragment key={key}>{token}</Fragment>;
    });
}

type Block =
  | { kind: "paragraph" | "quote"; content: string }
  | { kind: "heading"; content: string; level: 2 | 3 | 4 }
  | { kind: "list"; items: string[] };

function parseBlocks(value: string): Block[] {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    if (!lines[index].trim()) {
      index += 1;
      continue;
    }

    const heading = lines[index].match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1].length as 2 | 3 | 4,
        content: heading[2],
      });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(lines[index])) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ kind: "quote", content: quote.join("\n") });
      continue;
    }

    if (/^[-*]\s+/.test(lines[index])) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ kind: "list", items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{2,4})\s+/.test(lines[index]) &&
      !/^>\s?/.test(lines[index]) &&
      !/^[-*]\s+/.test(lines[index])
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push({ kind: "paragraph", content: paragraph.join("\n") });
  }

  return blocks;
}

export function RichTextContent({ value, className }: { value: string; className?: string }) {
  return (
    <div className={clsx("space-y-[0.9em] text-pretty", className)}>
      {parseBlocks(value).map((block, index) => {
        const key = `${block.kind}-${index}`;
        if (block.kind === "heading") {
          const Tag = `h${block.level}` as "h2" | "h3" | "h4";
          return (
            <Tag key={key} className="font-grotesk font-semibold leading-tight text-balance">
              {inlineContent(block.content)}
            </Tag>
          );
        }
        if (block.kind === "quote") {
          return (
            <blockquote
              key={key}
              className="whitespace-pre-line border-l-2 border-mg-accent pl-4 font-serif text-[1.1em] italic"
            >
              {inlineContent(block.content)}
            </blockquote>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={key} className="list-disc space-y-[0.35em] pl-6">
              {block.items.map((item, itemIndex) => (
                <li key={`${itemIndex}-${item}`}>{inlineContent(item)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={key} className="whitespace-pre-line">
            {inlineContent(block.content)}
          </p>
        );
      })}
    </div>
  );
}
