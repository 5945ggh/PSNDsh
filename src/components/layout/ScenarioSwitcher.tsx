"use client";

import React, { useState } from "react";
import { useData } from "@/context/MockContext";
import type { ScenarioPreset } from "@/lib/mock/types";
import { Sliders, Check, X } from "lucide-react";

export const ScenarioSwitcher: React.FC = () => {
  const { scenario, setScenario, isMockTransport } = useData();
  const [isOpen, setIsOpen] = useState(false);

  const presets: Array<{ id: ScenarioPreset; label: string; desc: string }> = [
    { id: "normal", label: "标准真实场景", desc: "完整条目树、周历与正常天气" },
    { id: "empty", label: "新用户空状态", desc: "无条目、专注与日程" },
    { id: "reg_closed", label: "注册机制关闭", desc: "演示公开注册关闭拦截" },
    { id: "weather_stale", label: "天气数据旧缓存", desc: "演示旧缓存观察时间标记" },
    { id: "weather_unavailable", label: "天气服务降级", desc: "演示气象接口超时降级" },
  ];

  if (!isMockTransport) return null;

  return (
    <aside aria-label="Mock 场景切换控制台" className="fixed bottom-20 right-4 z-50 md:bottom-4">
      {isOpen ? (
        <div className="app-scenario-panel w-64 rounded-lg p-3 text-xs text-[var(--text-primary)]">
          <div className="mb-2 flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 font-semibold">
            <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
              <Sliders className="w-3.5 h-3.5 text-[var(--accent)]" aria-hidden="true" />
              场景演示控制台
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="关闭场景控制台"
              className="app-shell-icon-button rounded-md p-1"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="space-y-1.5">
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setScenario(p.id);
                  setIsOpen(false);
                }}
                className={`w-full rounded-md border p-2 text-left transition-colors flex items-start justify-between ${
                  scenario === p.id
                    ? "border-[var(--border-strong)] bg-[var(--surface-rail-active)] text-[var(--text-primary)]"
                    : "border-transparent text-[var(--text-secondary)] hover:border-[var(--border-subtle)] hover:bg-[var(--surface-rail-hover)]"
                }`}
              >
                <div>
                  <div className="font-medium">{p.label}</div>
                  <div className="mt-0.5 text-[10px] text-[var(--text-muted)]">{p.desc}</div>
                </div>
                {scenario === p.id && (
                  <Check className="ml-1 mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="打开场景演示控制台"
          className="app-scenario-toggle flex items-center gap-1.5 rounded-md px-3 py-2 text-xs transition-colors"
        >
          <Sliders className="w-3.5 h-3.5 text-[var(--accent)]" aria-hidden="true" />
          <span>演示场景: {presets.find((p) => p.id === scenario)?.label}</span>
        </button>
      )}
    </aside>
  );
};
