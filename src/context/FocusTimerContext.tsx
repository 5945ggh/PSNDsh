"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useData } from "./MockContext";
import { FocusSession, FocusSegment } from "@/types/mock";

interface FocusTimerContextType {
  activeFocus: FocusSession | null;
  elapsedSeconds: number;
  formattedTime: string;
  isSplitModalOpen: boolean;
  isManualModalOpen: boolean;
  setIsSplitModalOpen: (open: boolean) => void;
  setIsManualModalOpen: (open: boolean) => void;
  startFocus: (entryId?: string | null) => Promise<void>;
  triggerStopFocus: () => void;
  finishStopFocus: (
    outcome: string | null,
    note: string | null,
    segments: FocusSegment[]
  ) => Promise<void>;
}

const FocusTimerContext = createContext<FocusTimerContextType | null>(null);

export const FocusTimerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { api, data, mutate } = useData();
  const activeFocus: FocusSession | null = data.activeFocus;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSplitModalOpen, setIsSplitModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // High performance 1s timer tick that ONLY updates elapsedSeconds
  useEffect(() => {
    if (!activeFocus) {
      return;
    }

    const calcElapsed = () => {
      const startMs = new Date(activeFocus.startedAt).getTime();
      const nowMs = Date.now();
      const sec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setElapsedSeconds(sec);
    };

    const interval = setInterval(calcElapsed, 1000);
    calcElapsed();
    return () => clearInterval(interval);
  }, [activeFocus]);

  const formatSeconds = useCallback((totalSec: number): string => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
        2,
        "0"
      )}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }, []);

  const startFocus = async (entryId?: string | null) => {
    try {
      await mutate(() => api.startFocusSession(entryId), {
        backgroundRefresh: true,
        update: (snapshot, session) => ({
          ...snapshot,
          activeFocus: session,
          focusSessions: [session, ...snapshot.focusSessions.filter((item) => item.id !== session.id)],
          dashboard: snapshot.dashboard
            ? { ...snapshot.dashboard, activeFocus: session }
            : null,
        }),
      });
    } catch (err: unknown) {
      if (err instanceof Error) {
        alert(err.message);
      }
    }
  };

  const triggerStopFocus = () => {
    setIsSplitModalOpen(true);
  };

  const finishStopFocus = async (
    outcome: string | null,
    note: string | null,
    segments: FocusSegment[]
  ) => {
    if (activeFocus) {
      try {
        await mutate(() => api.stopFocusSession(activeFocus.id, outcome, note, segments), {
          backgroundRefresh: true,
          update: (snapshot, session) => ({
            ...snapshot,
            activeFocus: null,
            focusSessions: snapshot.focusSessions.map((item) => item.id === session.id ? session : item),
            dashboard: snapshot.dashboard
              ? { ...snapshot.dashboard, activeFocus: null }
              : null,
          }),
        });
        setIsSplitModalOpen(false);
      } catch (err: unknown) {
        if (err instanceof Error) {
          alert(err.message);
        }
      }
    }
  };

  return (
    <FocusTimerContext.Provider
      value={{
        activeFocus,
        elapsedSeconds,
        formattedTime: formatSeconds(elapsedSeconds),
        isSplitModalOpen,
        isManualModalOpen,
        setIsSplitModalOpen,
        setIsManualModalOpen,
        startFocus,
        triggerStopFocus,
        finishStopFocus,
      }}
    >
      {children}
    </FocusTimerContext.Provider>
  );
};

export const useFocusTimer = () => {
  const ctx = useContext(FocusTimerContext);
  if (!ctx) {
    throw new Error("useFocusTimer must be used within a FocusTimerProvider");
  }
  return ctx;
};
