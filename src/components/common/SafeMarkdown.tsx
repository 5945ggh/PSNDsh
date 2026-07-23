"use client";

import React from "react";

const inlinePatterns = [
  { type: "code", regex: /`([^`]+)`/ },
  { type: "bold", regex: /\*\*([^*]+)\*\*/ },
  { type: "italic", regex: /(?<!\*)\*([^*]+)\*(?!\*)/ },
  { type: "link", regex: /\[([^\]]+)\]\(([^)]+)\)/ },
] as const;

const safeHref = (href: string) => {
  const trimmed = href.trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return trimmed;
  return null;
};

const renderInline = (text: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining) {
    const next = inlinePatterns
      .map((pattern) => {
        const match = pattern.regex.exec(remaining);
        return match ? { ...pattern, match, index: match.index } : null;
      })
      .filter((match) => match !== null)
      .sort((a, b) => a.index - b.index)[0];

    if (!next) {
      nodes.push(remaining);
      break;
    }

    if (next.index > 0) nodes.push(remaining.slice(0, next.index));

    const [raw] = next.match;
    if (next.type === "code") {
      nodes.push(
        <code
          key={`inline-${key++}`}
          className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.9em] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
        >
          {next.match[1]}
        </code>
      );
    } else if (next.type === "bold") {
      nodes.push(
        <strong key={`inline-${key++}`} className="font-semibold text-zinc-800 dark:text-zinc-100">
          {next.match[1]}
        </strong>
      );
    } else if (next.type === "italic") {
      nodes.push(
        <em key={`inline-${key++}`} className="italic">
          {next.match[1]}
        </em>
      );
    } else {
      const href = safeHref(next.match[2] ?? "");
      nodes.push(
        href ? (
          <a
            key={`inline-${key++}`}
            href={href}
            className="text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700 dark:text-blue-400"
            rel={href.startsWith("http") ? "noreferrer" : undefined}
            target={href.startsWith("http") ? "_blank" : undefined}
          >
            {next.match[1]}
          </a>
        ) : (
          <span key={`inline-${key++}`}>{next.match[1]}</span>
        )
      );
    }

    remaining = remaining.slice(next.index + raw.length);
  }

  return nodes;
};

const isUnorderedItem = (line: string) => /^\s*[-*]\s+/.test(line);
const isOrderedItem = (line: string) => /^\s*\d+\.\s+/.test(line);

export const SafeMarkdown: React.FC<{ content: string; fallback?: string; className?: string }> = ({
  content,
  fallback,
  className,
}) => {
  const source = content.trim() ? content : fallback ?? "";
  const lines = source.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const headingClass =
        level === 1
          ? "text-base font-semibold"
          : level === 2
            ? "text-sm font-semibold"
            : "text-xs font-semibold";
      const Tag = `h${level}` as "h1" | "h2" | "h3";
      blocks.push(
        <Tag key={`block-${index}`} className={`${headingClass} text-zinc-900 dark:text-zinc-100`}>
          {renderInline(heading[2])}
        </Tag>
      );
      continue;
    }

    if (isUnorderedItem(line) || isOrderedItem(line)) {
      const ordered = isOrderedItem(line);
      const items: React.ReactNode[] = [];
      while (index < lines.length && (ordered ? isOrderedItem(lines[index]) : isUnorderedItem(lines[index]))) {
        items.push(
          <li key={`item-${index}`}>
            {renderInline(lines[index].replace(ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/, ""))}
          </li>
        );
        index += 1;
      }
      index -= 1;
      const ListTag = ordered ? "ol" : "ul";
      blocks.push(
        <ListTag
          key={`block-${index}`}
          className={`space-y-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}
        >
          {items}
        </ListTag>
      );
      continue;
    }

    const quote = /^>\s?(.+)$/.exec(line);
    if (quote) {
      blocks.push(
        <blockquote
          key={`block-${index}`}
          className="border-l-2 border-zinc-300 pl-3 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400"
        >
          {renderInline(quote[1])}
        </blockquote>
      );
      continue;
    }

    const paragraph = [line.trim()];
    while (
      index + 1 < lines.length &&
      lines[index + 1].trim() &&
      !/^(#{1,3})\s+/.test(lines[index + 1]) &&
      !isUnorderedItem(lines[index + 1]) &&
      !isOrderedItem(lines[index + 1]) &&
      !/^>\s?/.test(lines[index + 1])
    ) {
      index += 1;
      paragraph.push(lines[index].trim());
    }

    blocks.push(
      <p key={`block-${index}`} className="leading-relaxed">
        {renderInline(paragraph.join(" "))}
      </p>
    );
  }

  return <div className={className}>{blocks}</div>;
};
