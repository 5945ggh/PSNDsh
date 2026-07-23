"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, LoaderCircle, Plus, Save, Trash2, X } from "lucide-react";
import { useData } from "@/context/MockContext";
import type {
  ScheduleTemplate,
  ScheduleTemplateApplication,
  ScheduleTemplateInput,
  ScheduleTemplatePreview,
  TemplateWeekday,
} from "@/types/mock";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => Promise<void>;
};

type DraftItem = ScheduleTemplateInput["items"][number];

const weekdayOptions: Array<{ value: TemplateWeekday; label: string }> = [
  { value: "MO", label: "一" }, { value: "TU", label: "二" }, { value: "WE", label: "三" },
  { value: "TH", label: "四" }, { value: "FR", label: "五" }, { value: "SA", label: "六" }, { value: "SU", label: "日" },
];

const newItem = (): DraftItem => ({
  weekdays: ["MO", "TU", "WE", "TH", "FR"],
  title: "",
  description: null,
  kind: "plan",
  location: null,
  colorKey: "green",
  startTime: "09:00",
  endTime: "10:00",
});

const dateLabel = (value: string) => new Intl.DateTimeFormat("zh-CN", {
  month: "numeric", day: "numeric", timeZone: "Asia/Shanghai",
}).format(new Date(`${value}T00:00:00+08:00`));

const formatTime = (value: string) => new Intl.DateTimeFormat("zh-CN", {
  hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Shanghai",
}).format(new Date(value));

const currentWeek = () => {
  const now = new Date();
  const local = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Shanghai",
  }).formatToParts(now);
  const part = (type: string) => Number(local.find((item) => item.type === type)?.value ?? 0);
  const date = new Date(Date.UTC(part("year"), part("month") - 1, part("day")));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
};

const shiftDate = (date: string, days: number) => {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

export function ScheduleTemplateManager({ isOpen, onClose, onChanged }: Props) {
  const { api } = useData();
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);
  const [applications, setApplications] = useState<ScheduleTemplateApplication[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<DraftItem[]>([newItem()]);
  const [fromDate, setFromDate] = useState(currentWeek);
  const [toDate, setToDate] = useState(() => shiftDate(currentWeek(), 6));
  const [preview, setPreview] = useState<ScheduleTemplatePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = useMemo(() => templates.find((template) => template.id === selectedId) ?? null, [selectedId, templates]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextTemplates, nextApplications] = await Promise.all([
        api.getScheduleTemplates(),
        api.getScheduleTemplateApplications(),
      ]);
      setTemplates(nextTemplates);
      setApplications(nextApplications);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "模板加载失败");
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [isOpen, load]);

  if (!isOpen) return null;

  const resetDraft = () => {
    setSelectedId(null);
    setName("");
    setDescription("");
    setItems([newItem()]);
    setPreview(null);
  };

  const selectTemplate = (template: ScheduleTemplate) => {
    setSelectedId(template.id);
    setName(template.name);
    setDescription(template.description ?? "");
    setItems(template.items.map((item) => ({
      weekdays: item.weekdays,
      title: item.title,
      description: item.description,
      kind: item.kind,
      location: item.location,
      colorKey: item.colorKey,
      startTime: item.startTime,
      endTime: item.endTime,
    })));
    setPreview(null);
  };

  const updateItem = (index: number, patch: Partial<DraftItem>) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const toggleWeekday = (index: number, weekday: TemplateWeekday) => {
    const current = items[index]?.weekdays ?? [];
    const weekdays = current.includes(weekday) ? current.filter((value) => value !== weekday) : [...current, weekday];
    updateItem(index, { weekdays });
  };

  const applyWeekdayPreset = (index: number, preset: "weekdays" | "weekend" | "all") => {
    updateItem(index, {
      weekdays: preset === "weekdays" ? ["MO", "TU", "WE", "TH", "FR"] : preset === "weekend" ? ["SA", "SU"] : ["MO", "TU", "WE", "TH", "FR", "SA", "SU"],
    });
  };

  const draft = (): ScheduleTemplateInput => ({
    name,
    description: description.trim() || null,
    items,
  });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const saved = selectedId
        ? await api.updateScheduleTemplate(selectedId, draft())
        : await api.createScheduleTemplate(draft());
      setSelectedId(saved.id);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "模板保存失败");
    } finally {
      setSaving(false);
    }
  };

  const deleteTemplate = async () => {
    if (!selectedTemplate || !window.confirm(`确定删除模板“${selectedTemplate.name}”吗？已应用的日程也会随模板删除。`)) return;
    setSaving(true);
    try {
      await api.deleteScheduleTemplate(selectedTemplate.id);
      resetDraft();
      await load();
      await onChanged();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "模板删除失败");
    } finally {
      setSaving(false);
    }
  };

  const loadPreview = async () => {
    if (!selectedTemplate) {
      setError("请先保存并选择一个模板");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      setPreview(await api.previewScheduleTemplate(selectedTemplate.id, fromDate, toDate));
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "模板预览失败");
    } finally {
      setSaving(false);
    }
  };

  const apply = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    setError(null);
    try {
      await api.applyScheduleTemplate(selectedTemplate.id, fromDate, toDate);
      setPreview(null);
      await load();
      await onChanged();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "模板应用失败");
    } finally {
      setSaving(false);
    }
  };

  const deleteApplication = async (application: ScheduleTemplateApplication) => {
    if (!window.confirm(`删除“${application.templateName}”的 ${application.blockCount} 项日程吗？`)) return;
    setSaving(true);
    try {
      await api.deleteScheduleTemplateApplication(application.id);
      await load();
      await onChanged();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "应用批次删除失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" aria-labelledby="schedule-template-title" className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white text-zinc-900 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-emerald-600" aria-hidden="true" /><h2 id="schedule-template-title" className="font-semibold">可复用作息模板</h2></div>
          <button type="button" onClick={onClose} aria-label="关闭作息模板" className="rounded p-1 text-zinc-400 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:text-zinc-200"><X className="h-5 w-5" aria-hidden="true" /></button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="border-b border-zinc-200 p-4 dark:border-zinc-800 md:border-b-0 md:border-r">
            <div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">我的模板</h3><button type="button" onClick={resetDraft} aria-label="新建模板" className="rounded p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"><Plus className="h-4 w-4" aria-hidden="true" /></button></div>
            {loading ? <div className="flex items-center gap-2 py-5 text-xs text-zinc-500"><LoaderCircle className="h-4 w-4 animate-spin" />加载中...</div> : templates.length === 0 ? <p className="text-xs leading-5 text-zinc-500">还没有模板。把固定的工作日、周末或假期作息保存下来，之后可按日期范围再次应用。</p> : <div className="space-y-1">{templates.map((template) => <button key={template.id} type="button" onClick={() => selectTemplate(template)} className={`w-full rounded-md px-3 py-2 text-left text-sm ${selectedId === template.id ? "bg-emerald-50 font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200" : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}><span className="block truncate">{template.name}</span><span className="mt-0.5 block text-[11px] text-zinc-400">{template.items.length} 个规则</span></button>)}</div>}
          </aside>

          <main className="min-w-0 space-y-5 p-5">
            <section className="space-y-3">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><label className="text-xs font-medium">模板名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：暑假作息" className="mt-1.5 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700" /></label><label className="text-xs font-medium">说明<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="可选" className="mt-1.5 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-zinc-700" /></label></div>
              <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">日程规则</h3><button type="button" onClick={() => setItems((current) => [...current, newItem()])} className="flex items-center gap-1 rounded-md border border-zinc-300 px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"><Plus className="h-3.5 w-3.5" aria-hidden="true" />添加规则</button></div>
              <div className="space-y-3">{items.map((item, index) => <div key={index} className="space-y-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="flex items-start gap-2"><input value={item.title} onChange={(event) => updateItem(index, { title: event.target.value })} placeholder="日程标题" className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-2.5 py-2 text-sm outline-none focus:border-emerald-500 dark:border-zinc-700" /><select value={item.kind} onChange={(event) => updateItem(index, { kind: event.target.value as DraftItem["kind"] })} className="rounded-md border border-zinc-300 bg-transparent px-2 py-2 text-xs dark:border-zinc-700"><option value="plan">计划</option><option value="course">课程</option><option value="other">其他</option></select><button type="button" onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={items.length === 1} aria-label="删除规则" className="rounded p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"><Trash2 className="h-4 w-4" aria-hidden="true" /></button></div>
                <div className="flex flex-wrap items-center gap-1.5"><span className="mr-1 text-xs text-zinc-500">重复</span>{weekdayOptions.map((weekday) => <button key={weekday.value} type="button" onClick={() => toggleWeekday(index, weekday.value)} className={`h-7 w-7 rounded-full text-xs font-medium ${item.weekdays.includes(weekday.value) ? "bg-emerald-600 text-white" : "border border-zinc-300 text-zinc-500 dark:border-zinc-700"}`}>{weekday.label}</button>)}<button type="button" onClick={() => applyWeekdayPreset(index, "weekdays")} className="ml-1 rounded px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">工作日</button><button type="button" onClick={() => applyWeekdayPreset(index, "weekend")} className="rounded px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">周末</button><button type="button" onClick={() => applyWeekdayPreset(index, "all")} className="rounded px-2 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">全周</button></div>
                <div className="grid gap-2 sm:grid-cols-4"><label className="text-[11px] text-zinc-500">开始<input type="time" value={item.startTime} onChange={(event) => updateItem(index, { startTime: event.target.value })} className="mt-1 w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-xs dark:border-zinc-700" /></label><label className="text-[11px] text-zinc-500">结束<input type="time" value={item.endTime} onChange={(event) => updateItem(index, { endTime: event.target.value })} className="mt-1 w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-xs dark:border-zinc-700" /></label><label className="text-[11px] text-zinc-500">地点<input value={item.location ?? ""} onChange={(event) => updateItem(index, { location: event.target.value || null })} className="mt-1 w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-xs dark:border-zinc-700" /></label><label className="text-[11px] text-zinc-500">备注<input value={item.description ?? ""} onChange={(event) => updateItem(index, { description: event.target.value || null })} className="mt-1 w-full rounded border border-zinc-300 bg-transparent px-2 py-1.5 text-xs dark:border-zinc-700" /></label></div>
              </div>)}</div>
              <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => void save()} disabled={saving || !name.trim()} className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"><Save className="h-3.5 w-3.5" aria-hidden="true" />{saving ? "保存中..." : selectedId ? "保存修改" : "保存模板"}</button>{selectedTemplate && <button type="button" onClick={() => void deleteTemplate()} disabled={saving} className="flex items-center gap-1.5 rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:hover:bg-red-950/30"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />删除模板</button>}</div>
            </section>

            <section className="border-t border-zinc-200 pt-5 dark:border-zinc-800"><h3 className="mb-3 text-sm font-semibold">应用到具体日期</h3><div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"><label className="text-xs text-zinc-500">开始日期<input type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPreview(null); }} className="mt-1.5 w-full rounded-md border border-zinc-300 bg-transparent px-2.5 py-2 text-sm dark:border-zinc-700" /></label><label className="text-xs text-zinc-500">结束日期<input type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPreview(null); }} className="mt-1.5 w-full rounded-md border border-zinc-300 bg-transparent px-2.5 py-2 text-sm dark:border-zinc-700" /></label><button type="button" onClick={() => void loadPreview()} disabled={saving || !selectedTemplate} className="rounded-md border border-emerald-300 px-3 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30">预览</button></div>
              {preview && <div className="mt-3 rounded-md bg-emerald-50/70 p-3 text-xs dark:bg-emerald-950/20"><div className="flex flex-wrap items-center justify-between gap-2"><span>将生成 <strong>{preview.blocks.length}</strong> 项日程（{dateLabel(fromDate)} 至 {dateLabel(toDate)}）</span><button type="button" onClick={() => void apply()} disabled={saving} className="rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50">确认应用</button></div><div className="mt-2 max-h-32 space-y-1 overflow-y-auto text-zinc-600 dark:text-zinc-300">{preview.blocks.map((block, index) => <div key={`${block.itemId}-${block.startedAt}-${index}`} className="flex justify-between gap-3"><span className="truncate">{block.title}{block.location ? ` · ${block.location}` : ""}</span><span className="shrink-0 font-mono">{formatTime(block.startedAt)}–{formatTime(block.endedAt)}</span></div>)}</div></div>}
            </section>

            <section className="border-t border-zinc-200 pt-5 dark:border-zinc-800"><h3 className="mb-3 text-sm font-semibold">已应用批次</h3>{applications.length === 0 ? <p className="text-xs text-zinc-500">还没有模板应用批次。</p> : <div className="space-y-2">{applications.map((application) => <div key={application.id} className="flex items-center justify-between gap-3 border-b border-zinc-100 pb-2 text-xs last:border-0 dark:border-zinc-800"><div className="min-w-0"><div className="truncate font-medium">{application.templateName}</div><div className="mt-0.5 text-zinc-500">{application.fromDate} 至 {application.toDate} · {application.blockCount} 项</div></div><button type="button" onClick={() => void deleteApplication(application)} disabled={saving} aria-label={`删除 ${application.templateName} 应用批次`} className="flex shrink-0 items-center gap-1 rounded px-2 py-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />删除整批</button></div>)}</div>}</section>
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </main>
        </div>
        <div className="flex justify-end border-t border-zinc-200 px-5 py-3 dark:border-zinc-800"><button type="button" onClick={onClose} className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">关闭</button></div>
      </div>
    </div>
  );
}
