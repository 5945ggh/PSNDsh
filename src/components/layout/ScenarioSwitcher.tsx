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
        <div className="bg-zinc-900 border border-zinc-700 text-zinc-100 rounded-lg shadow-xl p-3 w-64 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between font-semibold border-b border-zinc-800 pb-2 mb-2">
            <span className="flex items-center gap-1.5 text-zinc-300">
              <Sliders className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
              场景演示控制台
            </span>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="关闭场景控制台"
              className="text-zinc-400 hover:text-white p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
          <div className="space-y-1.5">
            {presets.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setScenario(p.id);
                  setIsOpen(false);
                }}
                className={`w-full text-left p-2 rounded transition-colors flex items-start justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  scenario === p.id
                    ? "bg-blue-600/20 border border-blue-500/40 text-blue-300"
                    : "hover:bg-zinc-800 text-zinc-300"
                }`}
              >
                <div>
                  <div className="font-medium">{p.label}</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">{p.desc}</div>
                </div>
                {scenario === p.id && (
                  <Check className="w-4 h-4 text-blue-400 shrink-0 ml-1 mt-0.5" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="打开场景演示控制台"
          className="flex items-center gap-1.5 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white text-xs px-3 py-2 rounded-full shadow-lg backdrop-blur transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <Sliders className="w-3.5 h-3.5 text-blue-400" aria-hidden="true" />
          <span>演示场景: {presets.find((p) => p.id === scenario)?.label}</span>
        </button>
      )}
    </aside>
  );
};
