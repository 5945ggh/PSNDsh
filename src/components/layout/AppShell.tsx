"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlobalFocusBar } from "./GlobalFocusBar";
import { ScenarioSwitcher } from "./ScenarioSwitcher";
import { useData } from "@/context/MockContext";
import {
  Home,
  ListTodo,
  Calendar as CalendarIcon,
  BarChart3,
  Settings,
  User,
  LogOut,
  ClipboardCheck,
} from "lucide-react";

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const { api, data, mutate } = useData();
  const user = data.session?.user;

  const handleLogout = async () => {
    await mutate(() => api.logout(), { refresh: false });
    window.location.assign("/login");
  };

  const navItems = [
    { label: "首页", href: "/", icon: Home },
    { label: "计划", href: "/plan", icon: ListTodo },
    { label: "日历", href: "/calendar", icon: CalendarIcon },
    { label: "统计", href: "/statistics", icon: BarChart3 },
    { label: "周复盘", href: "/review", icon: ClipboardCheck },
    { label: "设置", href: "/settings", icon: Settings },
  ];

  return (
    <div className="app-page min-h-screen flex flex-col font-sans">
      <GlobalFocusBar />

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        <aside
          aria-label="侧边主导航"
          className="app-shell-sidebar hidden md:flex w-60 flex-col justify-between border-r px-4 py-4 shrink-0"
        >
          <div>
            <div className="flex items-center gap-2.5 px-3 py-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-[var(--text-primary)] text-[var(--surface-raised)] flex items-center justify-center font-bold text-sm shadow-2xs">
                P
              </div>
              <div>
                <h1 className="font-semibold text-sm tracking-tight leading-none">
                  Personal Dash
                </h1>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">个人工作台</span>
              </div>
            </div>

            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-active={isActive}
                    className="app-shell-nav-link flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium"
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-[var(--border-subtle)] pt-4 px-3">
            <div className="flex items-center gap-2.5 justify-between">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-rail-soft)] text-[var(--text-secondary)]">
                  <User className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="truncate">
                  <p className="truncate text-xs font-medium">
                    {user?.nickname || user?.username || "个人用户"}
                  </p>
                  <p className="truncate font-mono text-[10px] text-[var(--text-muted)]">
                    {user?.email || "未绑定邮箱"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleLogout()}
                aria-label="退出登录"
                title="退出登录"
                className="app-shell-icon-button shrink-0 rounded-md p-1.5"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </aside>

        <main id="main-content" className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>

      <nav
        aria-label="移动端底部导航"
        className="app-rail md:hidden fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 rounded-t-lg"
      >
        <div className="grid grid-cols-6 gap-1 px-2 py-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={isActive}
                className="app-shell-nav-link flex min-w-0 flex-col items-center gap-1 rounded-md px-1.5 py-2 text-[11px] font-medium"
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <ScenarioSwitcher />
    </div>
  );
};
