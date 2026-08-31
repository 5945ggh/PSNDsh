"use client";

import { useEffect, useState, type FormEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Clipboard, Eye, EyeOff, KeyRound, LoaderCircle, Plus, RotateCw, Trash2 } from "lucide-react";
import type { ApiKeyCreated, ApiKeyMetadata } from "@/lib/application/contract";

type ApiKeyWithSecret = ApiKeyMetadata & { apiKey?: string };
type ApiResponse<T> = { data?: T; error?: { message?: string } };

const readApiResponse = async <T,>(response: Response): Promise<T> => {
  if (response.status === 204) return undefined as T;
  let body: ApiResponse<T> | null = null;
  try {
    body = await response.json() as ApiResponse<T>;
  } catch {
    // The fallback below gives the user a useful message for malformed responses.
  }
  if (!response.ok) {
    throw new Error(body?.error?.message || "API key 请求失败");
  }
  if (!body || !("data" in body)) throw new Error("服务返回了无法识别的数据");
  return body.data as T;
};

const apiRequest = async <T,>(url: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") headers.set("x-pd-same-origin", "1");
  if (init.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
  return readApiResponse<T>(await fetch(url, { ...init, credentials: "same-origin", headers }));
};

const copyText = async (value: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("当前浏览器不支持自动复制，请手动复制 API key");
};

const formatDate = (value: string | null) => value ? new Date(value).toLocaleString("zh-CN") : "从未使用";

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKeyMetadata[]>([]);
  const [name, setName] = useState("iPhone 快捷指令");
  const [revealed, setRevealed] = useState<ApiKeyWithSecret | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      setKeys(await apiRequest<ApiKeyMetadata[]>("/api/v1/api-keys"));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "API key 加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const initialLoad = async () => {
      setLoading(true);
      setError(null);
      try {
        const nextKeys = await apiRequest<ApiKeyMetadata[]>("/api/v1/api-keys");
        if (active) setKeys(nextKeys);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "API key 加载失败");
      } finally {
        if (active) setLoading(false);
      }
    };
    void initialLoad();
    return () => { active = false; };
  }, []);

  const createKey = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = name.trim();
    if (!normalized) {
      setError("请填写 API key 名称");
      return;
    }
    setSaving(true);
    setError(null);
    setCopied(false);
    try {
      const created = await apiRequest<ApiKeyCreated>("/api/v1/api-keys", {
        method: "POST",
        body: JSON.stringify({ name: normalized }),
      });
      setKeys((current) => [created, ...current]);
      setRevealed(created);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "API key 创建失败");
    } finally {
      setSaving(false);
    }
  };

  const revealKey = async (key: ApiKeyMetadata) => {
    setSaving(true);
    setError(null);
    setCopied(false);
    try {
      const result = await apiRequest<{ id: string; apiKey: string }>(`/api/v1/api-keys/${encodeURIComponent(key.id)}`);
      setRevealed({ ...key, apiKey: result.apiKey });
    } catch (revealError) {
      setError(revealError instanceof Error ? revealError.message : "API key 显示失败");
    } finally {
      setSaving(false);
    }
  };

  const revokeKey = async (key: ApiKeyMetadata) => {
    if (!window.confirm(`撤销“${key.name}”？已有快捷指令将立即失效。`)) return;
    setSaving(true);
    setError(null);
    try {
      await apiRequest<void>(`/api/v1/api-keys/${encodeURIComponent(key.id)}`, { method: "DELETE" });
      setKeys((current) => current.map((item) => item.id === key.id ? { ...item, revokedAt: new Date().toISOString() } : item));
      if (revealed?.id === key.id) setRevealed(null);
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "API key 撤销失败");
    } finally {
      setSaving(false);
    }
  };

  const copyRevealed = async () => {
    if (!revealed?.apiKey) return;
    try {
      await copyText(revealed.apiKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "API key 复制失败");
    }
  };

  return (
    <section aria-labelledby="settings-api-keys" className="space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        <h2 id="settings-api-keys" className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          快捷指令 API key
        </h2>
      </div>

      <div className="space-y-5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        <p className="max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          为 iPhone 快捷指令创建独立凭据。API key 只允许捕获开销，不代表网页登录会话。
        </p>

        <form onSubmit={createKey} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="min-w-0 flex-1 text-xs text-zinc-500">
            名称
            <input
              aria-label="API key 名称"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={100}
              className="mt-1 block w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm text-zinc-900 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:text-zinc-100"
            />
          </label>
          <button type="submit" disabled={saving || loading} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Plus className="h-3.5 w-3.5" aria-hidden="true" />}
            创建 API key
          </button>
        </form>

        <Dialog.Root open={Boolean(revealed?.apiKey)} onOpenChange={(open) => { if (!open) setRevealed(null); }}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150" />
            <Dialog.Content aria-describedby={undefined} className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-950 shadow-2xl animate-in fade-in zoom-in-95 duration-150 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-50">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Dialog.Title className="text-base font-semibold">{revealed?.name} 的完整 key</Dialog.Title>
                  <Dialog.Description className="mt-1 text-xs leading-5 text-amber-800 dark:text-amber-200">请将完整 key 填入快捷指令的 Authorization 请求头。不要提交到代码仓库。</Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button type="button" aria-label="隐藏完整 API key" title="关闭" className="rounded p-1.5 text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40">
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  </button>
                </Dialog.Close>
              </div>
              <div className="mt-4 flex items-stretch gap-2">
                <code className="min-w-0 flex-1 break-all rounded border border-amber-200 bg-white px-3 py-2 text-xs text-zinc-800 dark:border-amber-900 dark:bg-zinc-950 dark:text-zinc-200">{revealed?.apiKey}</code>
                <button type="button" onClick={() => void copyRevealed()} aria-label={copied ? "已复制 API key" : "复制 API key"} title={copied ? "已复制" : "复制 API key"} className="inline-flex shrink-0 items-center justify-center rounded border border-amber-300 px-3 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-100 dark:hover:bg-amber-900/40">
                  {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Clipboard className="h-4 w-4" aria-hidden="true" />}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>

        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {loading ? (
          <div className="flex items-center gap-2 py-3 text-sm text-zinc-500"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />加载中...</div>
        ) : keys.length === 0 ? (
          <p className="py-2 text-sm text-zinc-500">还没有 API key。</p>
        ) : (
          <div className="divide-y divide-zinc-200 border-y border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {keys.map((key) => (
              <div key={key.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    <span className="truncate">{key.name}</span>
                    {key.revokedAt && <span className="text-xs font-normal text-red-600 dark:text-red-400">已撤销</span>}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">创建于 {formatDate(key.createdAt)} · 最近使用：{formatDate(key.lastUsedAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {!key.revokedAt && (
                    <button type="button" onClick={() => void revealKey(key)} disabled={saving} aria-label={`显示 ${key.name} 的 API key`} title="显示 API key" className="rounded p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                  {!key.revokedAt && (
                    <button type="button" onClick={() => void revokeKey(key)} disabled={saving} aria-label={`撤销 ${key.name}`} title="撤销 API key" className="rounded p-2 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950/30">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <button type="button" onClick={() => void loadKeys()} disabled={loading || saving} className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 disabled:opacity-50 dark:hover:text-zinc-200">
          <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
          刷新列表
        </button>
      </div>
    </section>
  );
}
