"use client";

import React from "react";
import { useFocusTimer } from "@/context/FocusTimerContext";
import { useData } from "@/context/MockContext";
import { Play, Square, Timer, PlusCircle } from "lucide-react";

export const GlobalFocusBar: React.FC = () => {
  const {
    activeFocus,
    formattedTime,
    startFocus,
    triggerStopFocus,
    setIsManualModalOpen,
  } = useFocusTimer();
  const { data } = useData();

  const activeSegment = activeFocus?.segments?.[0];
  const assignedEntry = activeSegment?.entryId
    ? data.entries.find((entry) => entry.id === activeSegment.entryId)
    : null;

  return (
    <header className="app-focus-rail w-full px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex items-center gap-2 font-mono font-semibold tracking-wider text-base tabular-nums app-focus-time">
          <Timer className="w-4 h-4" aria-hidden="true" />
          <span aria-label={`当前专注时长 ${formattedTime}`}>{activeFocus ? formattedTime : "00:00"}</span>
        </div>

        <div className="h-4 w-px bg-[var(--border-subtle)] hidden sm:block" />

        <div className="hidden min-w-0 truncate text-xs sm:block sm:text-sm app-focus-muted">
          {activeFocus ? (
            <span className="flex items-center gap-1.5 truncate">
              <span className="w-2 h-2 rounded-full inline-block app-focus-dot" aria-hidden="true" />
              <span>当前专注：</span>
              <strong className="font-medium truncate text-[var(--text-primary)]">
                {assignedEntry ? assignedEntry.title : "未关联条目"}
              </strong>
            </span>
          ) : (
            <span>随时开启一次无归属专注，结束后可将时间拆分归属</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {activeFocus ? (
          <button
            type="button"
            onClick={triggerStopFocus}
            aria-label="结束当前专注"
            className="app-focus-action-destructive flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors"
          >
            <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
            <span>结束专注</span>
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => startFocus(null)}
              aria-label="开始无归属专注"
              className="app-shell-primary-button flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              <span>开始专注</span>
            </button>
            <button
              type="button"
              onClick={() => setIsManualModalOpen(true)}
              aria-label="补录专注记录"
              className="app-shell-secondary-button hidden sm:flex items-center gap-1.5 rounded-md px-2.5 py-2 text-xs font-medium transition-colors"
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
