"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useData } from "@/context/MockContext";
import { useFocusTimer } from "@/context/FocusTimerContext";
import { IcsImportModal } from "./IcsImportModal";
import { ScheduleImportManager } from "./ScheduleImportManager";
import { ScheduleTemplateManager } from "./ScheduleTemplateManager";
import { ScheduleEditorModal } from "./ScheduleEditorModal";
import { CalendarEventDetails } from "./CalendarEventDetails";
import { FocusEventDetails } from "./FocusEventDetails";
import { CalendarToolbar, type CalendarViewMode, type TrackFilter } from "./CalendarToolbar";
import { CompactCalendar } from "./CompactCalendar";
import { DayOverview } from "./DayOverview";
import { WeekTimeline } from "./WeekTimeline";
import {
  currentShanghaiWeekStart,
  MOBILE_VIEWPORT_QUERY,
  shiftDateKey,
  weekDaysFor,
} from "./calendar-utils";
import type { CalendarPayload, FocusSegment, FocusSession, ScheduleBlock, ScheduleBlockInput } from "@/lib/domain/types";

const subscribeToMobileViewport = (onChange: () => void) => {
  const mediaQuery = window.matchMedia(MOBILE_VIEWPORT_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
};

const getMobileViewportSnapshot = () => window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
const getServerViewportSnapshot = () => false;

export default function CalendarController() {
  const router = useRouter();
  const { api, data, mutate, version } = useData();
  const { setIsManualModalOpen } = useFocusTimer();
  const [weekStart, setWeekStart] = useState(currentShanghaiWeekStart);
  const [calendar, setCalendar] = useState<CalendarPayload | null>(null);
  const [isCalendarLoading, setIsCalendarLoading] = useState(true);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [isIcsOpen, setIsIcsOpen] = useState(false);
  const [isImportManagerOpen, setIsImportManagerOpen] = useState(false);
  const [isTemplateManagerOpen, setIsTemplateManagerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<CalendarViewMode>("grid");
  const [hasChosenViewMode, setHasChosenViewMode] = useState(false);
  const [trackFilter, setTrackFilter] = useState<TrackFilter>("both");
  const [selectedDay, setSelectedDay] = useState(currentShanghaiWeekStart);
  const [activeScheduleModal, setActiveScheduleModal] = useState<ScheduleBlock | null>(null);
  const [activeFocusModal, setActiveFocusModal] = useState<FocusSession | null>(null);
  const [scheduleEditor, setScheduleEditor] = useState<ScheduleBlock | "new" | null>(null);
  const isMobileViewport = useSyncExternalStore(subscribeToMobileViewport, getMobileViewportSnapshot, getServerViewportSnapshot);
  const displayedViewMode = isMobileViewport && !hasChosenViewMode ? "day" : viewMode;
  const weekDays = useMemo(() => weekDaysFor(weekStart), [weekStart]);
  const scheduleBlocks = calendar?.scheduleBlocks ?? [];
  const focusSessions = calendar?.focusSessions ?? [];
  const entries = data.entries;

  const refreshCalendar = useCallback(async () => {
    setIsCalendarLoading(true);
    setCalendarError(null);
    try {
      setCalendar(await api.getCalendarPayload(
        `${weekStart}T00:00:00+08:00`,
        `${shiftDateKey(weekStart, 7)}T00:00:00+08:00`
      ));
    } catch (error) {
      setCalendarError(error instanceof Error ? error.message : "日历数据加载失败");
    } finally {
      setIsCalendarLoading(false);
    }
  }, [api, weekStart]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshCalendar(); }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshCalendar, version]);

  const changeWeek = (nextWeekStart: string) => {
    setWeekStart(nextWeekStart);
    setSelectedDay(nextWeekStart);
  };

  const selectViewMode = (mode: CalendarViewMode) => {
    setViewMode(mode);
    setHasChosenViewMode(true);
  };

  const saveSchedule = async (input: ScheduleBlockInput) => {
    if (scheduleEditor === "new") {
      await mutate(() => api.addScheduleBlock(input), {
        refresh: false,
        update: (snapshot, schedule) => ({ ...snapshot, scheduleBlocks: [...snapshot.scheduleBlocks, schedule] }),
      });
    } else if (scheduleEditor) {
      await mutate(() => api.updateScheduleBlock(scheduleEditor.id, input), {
        refresh: false,
        update: (snapshot, schedule) => ({ ...snapshot, scheduleBlocks: snapshot.scheduleBlocks.map((item) => item.id === schedule.id ? schedule : item) }),
      });
    }
    setScheduleEditor(null);
    await refreshCalendar();
  };

  const deleteSchedule = async (schedule: ScheduleBlock) => {
    if (!window.confirm(`确定删除“${schedule.title}”吗？`)) return;
    await mutate(() => api.deleteScheduleBlock(schedule.id), {
      refresh: false,
      update: (snapshot) => ({ ...snapshot, scheduleBlocks: snapshot.scheduleBlocks.filter((item) => item.id !== schedule.id) }),
    });
    setActiveScheduleModal(null);
    await refreshCalendar();
  };

  const handleFocusClick = (focus: FocusSession) => {
    const firstEntryId = focus.segments[0]?.entryId ?? null;
    const allSameEntry = Boolean(firstEntryId) && focus.segments.every((segment) => segment.entryId === firstEntryId);
    if (allSameEntry) {
      router.push(`/entries/${firstEntryId}`);
      return;
    }
    setActiveFocusModal(focus);
  };

  const saveFocusSegments = async (segments: FocusSegment[]) => {
    if (!activeFocusModal) return;
    const updated = await mutate(() => api.updateFocusSession(activeFocusModal.id, segments), {
      refresh: false,
      update: (snapshot, session) => ({
        ...snapshot,
        focusSessions: snapshot.focusSessions.map((item) => item.id === session.id ? session : item),
      }),
    });
    setCalendar((current) => current ? {
      ...current,
      focusSessions: current.focusSessions.map((item) => item.id === updated.id ? updated : item),
    } : current);
  };

  const selectedDayIndex = Math.max(0, weekDays.findIndex((day) => day.date === selectedDay));
  const selectedDayMeta = weekDays[selectedDayIndex]!;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <CalendarToolbar
        weekStart={weekStart}
        weekDays={weekDays}
        isCalendarLoading={isCalendarLoading}
        calendarError={calendarError}
        displayedViewMode={displayedViewMode}
        trackFilter={trackFilter}
        onWeekChange={changeWeek}
        onViewModeChange={selectViewMode}
        onTrackFilterChange={setTrackFilter}
        onOpenIcs={() => setIsIcsOpen(true)}
        onOpenImports={() => setIsImportManagerOpen(true)}
        onOpenTemplates={() => setIsTemplateManagerOpen(true)}
        onCreateSchedule={() => setScheduleEditor("new")}
        onCreateFocus={() => setIsManualModalOpen(true)}
      />

      {displayedViewMode === "grid" && <WeekTimeline weekDays={weekDays} scheduleBlocks={scheduleBlocks} focusSessions={focusSessions} entries={entries} trackFilter={trackFilter} onScheduleClick={setActiveScheduleModal} onFocusClick={handleFocusClick} onCreateSchedule={(date) => { setSelectedDay(date); setScheduleEditor("new"); }} />}
      {displayedViewMode === "compact" && <CompactCalendar weekDays={weekDays} scheduleBlocks={scheduleBlocks} focusSessions={focusSessions} entries={entries} onScheduleClick={setActiveScheduleModal} onFocusClick={handleFocusClick} />}
      {displayedViewMode === "day" && <DayOverview selectedDay={selectedDay} selectedDayMeta={selectedDayMeta} selectedDayIndex={selectedDayIndex} weekDays={weekDays} scheduleBlocks={scheduleBlocks} focusSessions={focusSessions} entries={entries} trackFilter={trackFilter} onSelectedDayChange={setSelectedDay} onScheduleClick={setActiveScheduleModal} onFocusClick={handleFocusClick} />}

      <CalendarEventDetails schedule={activeScheduleModal} onClose={() => setActiveScheduleModal(null)} onEdit={(schedule) => { setScheduleEditor(schedule); setActiveScheduleModal(null); }} onDelete={deleteSchedule} />
      <FocusEventDetails key={activeFocusModal?.id ?? "none"} focus={activeFocusModal} entries={entries} onClose={() => setActiveFocusModal(null)} onSave={saveFocusSegments} />
      {scheduleEditor && <ScheduleEditorModal key={scheduleEditor === "new" ? "new" : scheduleEditor.id} schedule={scheduleEditor === "new" ? null : scheduleEditor} defaultDate={selectedDay} onClose={() => setScheduleEditor(null)} onSave={saveSchedule} />}
      <IcsImportModal isOpen={isIcsOpen} onClose={() => setIsIcsOpen(false)} />
      <ScheduleImportManager isOpen={isImportManagerOpen} onClose={() => setIsImportManagerOpen(false)} onChanged={refreshCalendar} />
      <ScheduleTemplateManager isOpen={isTemplateManagerOpen} onClose={() => setIsTemplateManagerOpen(false)} onChanged={refreshCalendar} />
    </div>
  );
}
