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

type ParsedListLine = {
  indent: number;
  ordered: boolean;
  content: string;
};

const parseListLine = (line: string): ParsedListLine | null => {
  const match = /^([ \t]*)([-*]|\d+\.)\s+(.+)$/.exec(line);
  if (!match) return null;

  return {
    indent: (match[1] ?? "").replace(/\t/g, "    ").length,
    ordered: match[2]?.endsWith(".") === true && /^\d/.test(match[2]),
    content: match[3] ?? "",
  };
};

const isListItem = (line: string) => parseListLine(line) !== null;

const renderListContent = (content: string): React.ReactNode => {
  const checkbox = /^\[([ xX])\]\s+(.+)$/.exec(content);
  if (!checkbox) return renderInline(content);

  return (
    <span className="inline-flex items-start gap-1.5">
      <input
        type="checkbox"
        checked={checkbox[1].toLowerCase() === "x"}
        readOnly
        disabled
        aria-label={checkbox[1].toLowerCase() === "x" ? "已完成" : "未完成"}
        className="mt-0.5 h-3 w-3 shrink-0 accent-emerald-600"
      />
      <span className={checkbox[1].toLowerCase() === "x" ? "text-zinc-500 line-through dark:text-zinc-500" : undefined}>
        {renderInline(checkbox[2])}
      </span>
    </span>
  );
};

const renderListBlock = (lines: string[], startIndex: number): { node: React.ReactNode; nextIndex: number } => {
  const first = parseListLine(lines[startIndex] ?? "");
  if (!first) return { node: null, nextIndex: startIndex };

  const items: React.ReactNode[] = [];
  let index = startIndex;
  while (index < lines.length) {
    const current = parseListLine(lines[index] ?? "");
    if (!current || current.indent !== first.indent || current.ordered !== first.ordered) break;

    index += 1;
    let nested: React.ReactNode = null;
    const child = parseListLine(lines[index] ?? "");
    if (child && child.indent > first.indent) {
      const nestedBlock = renderListBlock(lines, index);
      nested = nestedBlock.node;
      index = nestedBlock.nextIndex;
    }

    items.push(
      <li key={`item-${index}-${items.length}`}>
        {renderListContent(current.content)}
        {nested}
      </li>,
    );
  }

  const ListTag = first.ordered ? "ol" : "ul";
  return {
    node: (
      <ListTag className={`space-y-1 pl-5 ${first.ordered ? "list-decimal" : "list-disc"}`}>
        {items}
      </ListTag>
    ),
    nextIndex: index,
  };
};

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

    if (isListItem(line)) {
      const listBlock = renderListBlock(lines, index);
      blocks.push(React.cloneElement(listBlock.node as React.ReactElement, { key: `block-${index}` }));
      index = listBlock.nextIndex - 1;
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
      !isListItem(lines[index + 1]) &&
      !/^>\s?/.test(lines[index + 1])
    ) {
      index += 1;
      paragraph.push(lines[index].trim());
    }

    const paragraphContent = paragraph.flatMap((line, lineIndex) => [
      ...(lineIndex > 0 ? [<br key={`break-${index}-${lineIndex}`} />] : []),
      ...renderInline(line),
    ]);

    blocks.push(
      <p key={`block-${index}`} className="leading-relaxed">
        {paragraphContent}
      </p>
    );
  }

  return <div className={className}>{blocks}</div>;
};
