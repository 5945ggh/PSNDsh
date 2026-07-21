"use client";

import React from "react";
import { useFocusTimer } from "@/context/FocusTimerContext";
import { useMock } from "@/context/MockContext";
import { Play, Square, Timer, PlusCircle } from "lucide-react";

export const GlobalFocusBar: React.FC = () => {
  const {
    activeFocus,
    formattedTime,
    startFocus,
    triggerStopFocus,
    setIsManualModalOpen,
  } = useFocusTimer();
  const { api } = useMock();

  const activeSegment = activeFocus?.segments?.[0];
  const assignedEntry = activeSegment?.entryId
    ? api.getEntryById(activeSegment.entryId)
    : null;

  return (
    <header className="w-full bg-zinc-900 text-zinc-100 border-b border-zinc-800 px-4 py-2.5 flex items-center justify-between text-sm shadow-2xs transition-all duration-200">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 font-mono font-semibold tracking-wider text-base text-blue-400 tabular-nums">
          <Timer className="w-4 h-4 text-blue-400 animate-pulse" aria-hidden="true" />
          <span aria-label={`当前专注时长 ${formattedTime}`}>{activeFocus ? formattedTime : "00:00"}</span>
        </div>

        <div className="h-4 w-px bg-zinc-700 hidden sm:block" />

        <div className="truncate text-zinc-300 text-xs sm:text-sm">
          {activeFocus ? (
            <span className="flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" aria-hidden="true" />
              <span>当前专注：</span>
              <strong className="text-zinc-100 font-medium truncate">
                {assignedEntry ? assignedEntry.title : "未关联条目"}
              </strong>
            </span>
          ) : (
            <span className="text-zinc-400">随时开启一次无归属专注，结束后可将时间拆分归属</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {activeFocus ? (
          <button
            onClick={triggerStopFocus}
            aria-label="结束当前专注"
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1.5 rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            <span>结束专注</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => startFocus(null)}
              aria-label="开始无归属专注"
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              <span>开始专注</span>
            </button>
            <button
              onClick={() => setIsManualModalOpen(true)}
              aria-label="补录专注记录"
              className="hidden sm:flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs px-2.5 py-1.5 rounded font-medium transition-colors border border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            >
              <PlusCircle className="w-3.5 h-3.5" aria-hidden="true" />
              <span>补录</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
