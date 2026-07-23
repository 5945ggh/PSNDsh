"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { ScheduleBlock, ScheduleBlockInput } from "@/types/mock";

type ScheduleEditorModalProps = {
  schedule: ScheduleBlock | null;
  defaultDate: string;
  onClose: () => void;
  onSave: (input: ScheduleBlockInput) => Promise<void>;
};

const SHANGHAI_TIME_ZONE = "Asia/Shanghai";

const toDateTimeLocal = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SHANGHAI_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
};

const defaultDateTime = (date: string, hour: string) => `${date}T${hour}`;
const toShanghaiIso = (value: string) => `${value}:00+08:00`;
const weekdayCodes = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
const weekdayLabels = ["一", "二", "三", "四", "五", "六", "日"];
const defaultWeekday = (date: string) => {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return weekdayCodes[day === 0 ? 6 : day - 1];
};

export function ScheduleEditorModal({
  schedule,
  defaultDate,
  onClose,
  onSave,
}: ScheduleEditorModalProps) {
  const isEditing = schedule !== null;
  const [title, setTitle] = useState(schedule?.title ?? "");
  const [kind, setKind] = useState<ScheduleBlockInput["kind"]>(schedule?.kind ?? "course");
  const [description, setDescription] = useState(schedule?.description ?? "");
  const [startedAt, setStartedAt] = useState(
    schedule ? toDateTimeLocal(schedule.startedAt) : defaultDateTime(defaultDate, "09:00")
  );
  const [endedAt, setEndedAt] = useState(
    schedule ? toDateTimeLocal(schedule.endedAt) : defaultDateTime(defaultDate, "10:00")
  );
  const [location, setLocation] = useState(schedule?.location ?? "");
  const [colorKey, setColorKey] = useState(schedule?.colorKey ?? "blue");
  const [repeatWeekly, setRepeatWeekly] = useState(Boolean(schedule?.recurrence));
  const [weekdays, setWeekdays] = useState<Array<(typeof weekdayCodes)[number]>>(
    schedule?.recurrence?.weekdays ?? [defaultWeekday(schedule?.startedAt ? toDateTimeLocal(schedule.startedAt).slice(0, 10) : defaultDate)]
  );
  const [until, setUntil] = useState(schedule?.recurrence?.until?.slice(0, 10) ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim()) {
      setError("请填写日程标题");
      return;
    }
    if (Date.parse(toShanghaiIso(endedAt)) <= Date.parse(toShanghaiIso(startedAt))) {
      setError("结束时间必须晚于开始时间");
      return;
    }
    if (repeatWeekly && weekdays.length === 0) {
      setError("请至少选择一个重复日");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        kind,
        startedAt: toShanghaiIso(startedAt),
        endedAt: toShanghaiIso(endedAt),
        location: location.trim() || null,
        colorKey,
        recurrence: repeatWeekly ? {
          frequency: "weekly",
          interval: 1,
          weekdays,
          until: until ? `${until}T23:59:59+08:00` : null,
        } : null,
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存日程失败");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-editor-title"
        className="w-full max-w-md rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 id="schedule-editor-title" className="text-base font-semibold">
            {isEditing ? "编辑日程" : "新增日程"}
          </h2>
          <button type="button" onClick={onClose} aria-label="关闭日程表单" className="rounded p-1 text-zinc-400 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-zinc-200">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm">
          <label className="block space-y-1" htmlFor="schedule-title">
            <span className="font-medium">日程标题</span>
            <input id="schedule-title" aria-label="日程标题" value={title} onChange={(event) => setTitle(event.target.value)} required className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950" />
          </label>

          <label className="block space-y-1" htmlFor="schedule-kind">
            <span className="font-medium">日程类型</span>
            <select id="schedule-kind" aria-label="日程类型" value={kind} onChange={(event) => setKind(event.target.value as ScheduleBlockInput["kind"])} className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950">
              <option value="course">课程</option>
              <option value="plan">计划</option>
              <option value="other">其他</option>
            </select>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block space-y-1" htmlFor="schedule-started-at">
              <span className="font-medium">开始时间</span>
              <input id="schedule-started-at" aria-label="开始时间" type="datetime-local" value={startedAt} onChange={(event) => setStartedAt(event.target.value)} required className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950" />
            </label>
            <label className="block space-y-1" htmlFor="schedule-ended-at">
              <span className="font-medium">结束时间</span>
              <input id="schedule-ended-at" aria-label="结束时间" type="datetime-local" value={endedAt} onChange={(event) => setEndedAt(event.target.value)} required className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950" />
            </label>
          </div>

          <label className="block space-y-1" htmlFor="schedule-location">
            <span className="font-medium">地点</span>
            <input id="schedule-location" aria-label="地点" value={location} onChange={(event) => setLocation(event.target.value)} className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950" />
          </label>

          <label className="block space-y-1" htmlFor="schedule-description">
            <span className="font-medium">备注</span>
            <textarea id="schedule-description" aria-label="日程备注" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="例如课程要求、线上会议链接或准备事项" className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950" />
          </label>

          <fieldset className="space-y-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <legend className="px-1 text-sm font-medium">重复规则</legend>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={repeatWeekly} onChange={(event) => setRepeatWeekly(event.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
              <span>每周重复</span>
            </label>
            {repeatWeekly && (
              <div className="space-y-2 pl-6">
                <div className="flex flex-wrap gap-2" aria-label="重复星期">
                  {weekdayCodes.map((code, index) => (
                    <label key={code} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={weekdays.includes(code)}
                        onChange={(event) => setWeekdays((current) => event.target.checked ? [...new Set([...current, code])] : current.filter((item) => item !== code))}
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>周{weekdayLabels[index]}</span>
                    </label>
                  ))}
                </div>
                <label className="block space-y-1" htmlFor="schedule-repeat-until">
                  <span className="text-xs text-zinc-500">重复截止日期（可选）</span>
                  <input id="schedule-repeat-until" aria-label="重复截止日期" type="date" value={until} onChange={(event) => setUntil(event.target.value)} className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950" />
                </label>
              </div>
            )}
          </fieldset>

          <label className="block space-y-1" htmlFor="schedule-color">
            <span className="font-medium">颜色</span>
            <select id="schedule-color" aria-label="颜色" value={colorKey} onChange={(event) => setColorKey(event.target.value)} className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-950">
              <option value="blue">蓝色</option>
              <option value="green">绿色</option>
              <option value="amber">琥珀色</option>
              <option value="rose">玫红色</option>
            </select>
          </label>

          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <button type="button" onClick={onClose} className="rounded-md px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-zinc-300 dark:hover:bg-zinc-800">取消</button>
          <button type="submit" disabled={isSaving} className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:bg-zinc-100 dark:text-zinc-900">
            {isSaving ? "保存中..." : isEditing ? "保存修改" : "保存日程"}
          </button>
        </div>
      </form>
    </div>
  );
}
