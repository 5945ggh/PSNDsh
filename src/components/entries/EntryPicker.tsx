"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, CornerDownRight, Search } from "lucide-react";
import type { Entry } from "@/lib/domain/types";

type EntryPickerProps = {
  id: string;
  value: string | null;
  entries: Entry[];
  onChange: (entryId: string | null) => void;
  ariaLabel: string;
  compact?: boolean;
};

const statusLabels: Record<Entry["status"], string> = {
  active: "活跃",
  paused: "暂停",
  completed: "已完成",
  archived: "已归档",
};

export const EntryPicker: React.FC<EntryPickerProps> = ({
  id,
  value,
  entries,
  onChange,
  ariaLabel,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const entryById = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const childrenByParentId = useMemo(() => {
    const grouped = new Map<string, Entry[]>();
    entries.forEach((entry) => {
      if (!entry.parentId) return;
      const children = grouped.get(entry.parentId) ?? [];
      children.push(entry);
      grouped.set(entry.parentId, children);
    });
    return grouped;
  }, [entries]);
  const selectedEntry = value ? entryById.get(value) ?? null : null;

  const getEntryPath = (entry: Entry) => {
    const path: string[] = [entry.title];
    const visited = new Set<string>([entry.id]);
    let parentId = entry.parentId;
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = entryById.get(parentId);
      if (!parent) break;
      path.unshift(parent.title);
      parentId = parent.parentId;
    }
    return path.join(" / ");
  };

  const visibleEntryIds = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return new Set(entries.map((entry) => entry.id));

    const visible = new Set<string>();
    entries.forEach((entry) => {
      const searchableText = `${entry.title} ${entry.description ?? ""}`.toLocaleLowerCase();
      if (!searchableText.includes(normalizedQuery)) return;

      let current: Entry | undefined = entry;
      while (current) {
        if (visible.has(current.id)) break;
        visible.add(current.id);
        current = current.parentId ? entryById.get(current.parentId) : undefined;
      }
    });
    return visible;
  }, [entries, entryById, query]);

  const rootEntries = useMemo(
    () => entries.filter((entry) => !entry.parentId || !entryById.has(entry.parentId)),
    [entries, entryById],
  );

  useEffect(() => {
    if (isOpen) searchRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const closePicker = () => {
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const selectEntry = (entryId: string | null) => {
    onChange(entryId);
    setQuery("");
    closePicker();
  };

  const renderEntryOptions = (parentId: string | null, depth: number): React.ReactNode[] => {
    const candidates = parentId === null ? rootEntries : childrenByParentId.get(parentId) ?? [];
    return candidates.flatMap((entry) => {
      if (!visibleEntryIds.has(entry.id)) return [];
      return [
        <button
          key={entry.id}
          type="button"
          role="option"
          aria-selected={entry.id === value}
          aria-label={entry.title}
          title={getEntryPath(entry)}
          onClick={() => selectEntry(entry.id)}
          className={`flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-xs transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-zinc-800 ${entry.id === value ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300" : "text-zinc-700 dark:text-zinc-200"}`}
          style={{ paddingInlineStart: `${8 + depth * 18}px` }}
        >
          {depth > 0 ? (
            <CornerDownRight className="h-3 w-3 shrink-0 text-zinc-400" aria-hidden="true" />
          ) : (
            <span className="h-3 w-3 shrink-0" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1 truncate">{entry.title}</span>
          <span className="shrink-0 text-[10px] text-zinc-400">{statusLabels[entry.status]}</span>
          {entry.id === value && <Check className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" />}
        </button>,
        ...renderEntryOptions(entry.id, depth + 1),
      ];
    });
  };

  return (
    <div ref={rootRef} className="space-y-1">
      <button
        id={id}
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={`${id}-options`}
        onClick={() => setIsOpen((current) => !current)}
        className={`flex w-full items-center justify-between gap-2 border border-zinc-300 bg-transparent text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 ${compact ? "rounded px-2 py-1" : "rounded-md px-3 py-2"}`}
      >
        <span className={`min-w-0 truncate ${selectedEntry ? "text-zinc-800 dark:text-zinc-100" : "text-zinc-400"}`}>
          {selectedEntry ? getEntryPath(selectedEntry) : "未关联（无归属）"}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          className="rounded-md border border-zinc-200 bg-white p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              closePicker();
              return;
            }
            if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
            event.preventDefault();
            const options = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]')
            );
            if (options.length === 0) return;
            const currentIndex = options.findIndex((option) => option === document.activeElement);
            const delta = event.key === "ArrowDown" ? 1 : -1;
            const nextIndex = (currentIndex + delta + options.length) % options.length;
            options[nextIndex]?.focus();
          }}
        >
          <div className="relative mb-1.5">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label={`${ariaLabel}搜索`}
              placeholder="搜索条目…"
              className="w-full rounded border border-zinc-200 bg-zinc-50 py-1.5 pl-7 pr-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>

          <div id={`${id}-options`} role="listbox" aria-label={`${ariaLabel}选项`} className="max-h-56 space-y-0.5 overflow-y-auto">
            <button
              type="button"
              role="option"
              aria-selected={value === null}
              onClick={() => selectEntry(null)}
              className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-zinc-800 ${value === null ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100" : "text-zinc-500 dark:text-zinc-400"}`}
            >
              <span className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="flex-1">未关联（无归属）</span>
              {value === null && <Check className="h-3.5 w-3.5 shrink-0 text-blue-600 dark:text-blue-300" aria-hidden="true" />}
            </button>
            {renderEntryOptions(null, 0)}
            {visibleEntryIds.size === 0 && <p className="px-2 py-3 text-center text-[11px] text-zinc-400">没有匹配的条目</p>}
          </div>
        </div>
      )}
    </div>
  );
};
