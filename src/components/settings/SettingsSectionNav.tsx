"use client";

import type { LucideIcon } from "lucide-react";

export type SettingsSectionNavItem = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

type SettingsSectionNavProps = {
  items: SettingsSectionNavItem[];
  activeId: string;
  onSelect: (id: string) => void;
};

export function SettingsSectionNav({ items, activeId, onSelect }: SettingsSectionNavProps) {
  return (
    <nav aria-label="设置页面二级导航" className="rounded-xl border border-zinc-200 bg-white/80 p-1.5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70">
      <div className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeId;

          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(item.id)}
              className={`flex min-w-[15rem] items-start gap-2.5 rounded-md border px-2.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 lg:min-w-0 ${
                isActive
                  ? "border-zinc-300 bg-zinc-100 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  : "border-transparent text-zinc-600 hover:border-zinc-200 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:border-zinc-800 dark:hover:bg-zinc-900/60"
              }`}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium leading-5">{item.title}</span>
                <span className="mt-0.5 block text-xs leading-5 text-zinc-500 dark:text-zinc-500">
                  {item.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
