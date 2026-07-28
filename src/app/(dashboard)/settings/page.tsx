"use client";

import React, { useState } from "react";
import { useData } from "@/context/MockContext";
import { Database, Download, Info, Save, User } from "lucide-react";

export default function SettingsPage() {
  const { api, data, isMockTransport, mutate, pendingMutations } = useData();
  const user = data.session?.user;

  const [nickname, setNickname] = useState(user?.nickname || "");
  const [email, setEmail] = useState(user?.email || "");

  const handleSaveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await mutate(() => api.updateUserProfile(nickname || null, email || null), {
        backgroundRefresh: true,
        update: (snapshot, profile) => ({
          ...snapshot,
          session: { user: profile },
          dashboard: snapshot.dashboard ? { ...snapshot.dashboard, profile } : null,
        }),
      });
      alert("个人资料已更新");
    } catch (error) {
      alert(error instanceof Error ? error.message : "资料保存失败");
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-8">
      <div className="space-y-8">
        <header className="border-b border-zinc-200 pb-4 dark:border-zinc-800">
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            个人设置
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            修改账户资料，查看 JSON 导出包含的内容。
          </p>
        </header>

        <section aria-labelledby="settings-profile" className="space-y-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-blue-500" aria-hidden="true" />
            <h2 id="settings-profile" className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              账户基本信息
            </h2>
          </div>

          <form onSubmit={handleSaveProfile} className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)] md:gap-6">
              <label htmlFor="profile-username" className="text-sm text-zinc-600 dark:text-zinc-400">
                账号
              </label>
              <div className="space-y-1">
                <input
                  id="profile-username"
                  type="text"
                  value={user?.username || "ningcc"}
                  disabled
                  className="w-full rounded-md border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-500 outline-none dark:border-zinc-800 dark:bg-zinc-900/60"
                />
                <p className="text-xs text-zinc-500">账号不可编辑。</p>
              </div>

              <label htmlFor="profile-nickname" className="text-sm text-zinc-600 dark:text-zinc-400">
                显示昵称
              </label>
              <div className="space-y-1">
                <input
                  id="profile-nickname"
                  type="text"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="设置首页显示的称呼"
                  className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700"
                />
                <p className="text-xs text-zinc-500">会显示在首页和资料区。</p>
              </div>

              <label htmlFor="profile-email" className="text-sm text-zinc-600 dark:text-zinc-400">
                绑定邮箱
              </label>
              <div className="space-y-2">
                <input
                  id="profile-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-zinc-700"
                />
                <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span>邮箱仅作联系标志，不做校验，也不用于找回密码。</span>
                </div>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="submit"
                disabled={pendingMutations > 0}
                className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{pendingMutations > 0 ? "正在保存..." : "保存资料修改"}</span>
              </button>
            </div>
          </form>
        </section>

        <section aria-labelledby="settings-export" className="space-y-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-purple-500" aria-hidden="true" />
            <h2 id="settings-export" className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              数据管理与 JSON 导出
            </h2>
          </div>

          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <p className="max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              导出包含当前账号资料、条目、周计划、日程、专注会话和片段，不含密码、会话和服务端密钥。
            </p>

            <pre className="mt-4 overflow-x-auto border border-zinc-200 bg-zinc-50 p-3 text-[11px] leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
              {`{
  "schemaVersion": "1.0",
  "exportedAt": "2026-06-26T10:00:00Z",
  "profile": { "username": "${user?.username}" },
  "entriesCount": ${data.entries.length},
  "focusSessionsCount": ${data.focusSessions.length},
  "scheduleBlocksCount": ${data.scheduleBlocks.length}
}`}
            </pre>

            {!isMockTransport && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => window.location.assign("/api/v1/export")}
                  className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>下载 JSON 导出</span>
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
