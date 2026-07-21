"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlobalFocusBar } from "./GlobalFocusBar";
import { ScenarioSwitcher } from "./ScenarioSwitcher";
import { useMock } from "@/context/MockContext";
import {
  Home,
  ListTodo,
  Calendar as CalendarIcon,
  BarChart3,
  Settings,
  User,
} from "lucide-react";

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const { api } = useMock();
  const user = api.getUser();

  const navItems = [
    { label: "首页", href: "/", icon: Home },
    { label: "计划", href: "/plan", icon: ListTodo },
    { label: "日历", href: "/calendar", icon: CalendarIcon },
    { label: "统计", href: "/statistics", icon: BarChart3 },
    { label: "设置", href: "/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 font-sans">
      {/* Top Persistent Global Focus Bar */}
      <GlobalFocusBar />

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Desktop Sidebar Navigation */}
        <aside
          aria-label="侧边主导航"
          className="hidden md:flex w-56 flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shrink-0 justify-between"
        >
          <div>
            <div className="flex items-center gap-2.5 px-3 py-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold text-sm shadow-2xs">
                P
              </div>
              <div>
                <h1 className="font-semibold text-sm tracking-tight leading-none">
                  Personal Dash
                </h1>
                <span className="text-[11px] text-zinc-400 font-mono">个人工作台</span>
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
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      isActive
                        ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 px-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                <User className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="truncate">
                <p className="text-xs font-medium truncate">
                  {user?.nickname || user?.username || "个人用户"}
                </p>
                <p className="text-[10px] text-zinc-400 truncate font-mono">
                  {user?.email || "未绑定邮箱"}
                </p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main id="main-content" className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        aria-label="移动端底部导航"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-around py-2 px-1"
      >
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
              className={`flex flex-col items-center gap-1 py-1 px-3 rounded-md text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400"
              }`}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Floating Scenario Switcher */}
      <ScenarioSwitcher />
    </div>
  );
};
