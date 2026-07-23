"use client";

import React, { useState } from "react";
import { useData } from "@/context/MockContext";
import { User, Database, Download, Save, Info } from "lucide-react";

export default function SettingsPage() {
  const { api, data, isMockTransport, mutate, pendingMutations } = useData();
  const user = data.session?.user;

  const [nickname, setNickname] = useState(user?.nickname || "");
  const [email, setEmail] = useState(user?.email || "");

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mutate(() => api.updateUserProfile(nickname || null, email || null), {
        backgroundRefresh: true,
        update: (snapshot, profile) => ({
          ...snapshot,
          session: { user: profile },
          dashboard: snapshot.dashboard
            ? { ...snapshot.dashboard, profile }
            : null,
        }),
      });
      alert("个人资料已更新");
    } catch (error) {
      alert(error instanceof Error ? error.message : "资料保存失败");
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm">
        <h1 className="text-xl font-bold tracking-tight">个人设置</h1>
        <p className="text-xs text-zinc-500 mt-1">
          管理账户资料与本地数据备份说明。
        </p>
      </div>

      {/* User Profile Form */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-6">
        <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <h2 className="font-semibold text-sm flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
            <User className="w-4 h-4 text-blue-500" />
            <span>账户基本信息</span>
          </h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
          <div>
            <label htmlFor="profile-username" className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              账号 (Username - 不可编辑)
            </label>
            <input
              id="profile-username"
              type="text"
              value={user?.username || "ningcc"}
              disabled
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 text-zinc-500 font-mono outline-none cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="profile-nickname" className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              显示昵称 (Nickname)
            </label>
            <input
              id="profile-nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="设置在首页显示的称呼..."
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-transparent outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          <div>
            <label htmlFor="profile-email" className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              绑定邮箱 (Email)
            </label>
            <input
              id="profile-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-transparent font-mono outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <Info className="w-3 h-3 shrink-0" />
              <span>说明：邮箱仅作为联系标志，系统不进行邮件校验，亦不用于密码找回。</span>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={pendingMutations > 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium shadow-sm hover:opacity-90 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{pendingMutations > 0 ? "正在保存..." : "保存资料修改"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Data Export & Backup Explanation */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <h2 className="font-semibold text-sm flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
            <Database className="w-4 h-4 text-purple-500" />
            <span>数据管理与 JSON 导出说明</span>
          </h2>
        </div>

        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          JSON 导出包含当前账号的资料、条目、周计划、日程、专注会话和片段。密码、会话与服务端密钥不会被写入导出文件。
        </p>

        <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 rounded-lg border border-zinc-200/60 dark:border-zinc-800 font-mono text-[11px] text-zinc-600 dark:text-zinc-400 overflow-x-auto">
          {`{
  "version": "1.0",
  "exportAt": "2026-06-26T10:00:00Z",
  "user": { "username": "${user?.username}" },
  "entriesCount": ${data.entries.length},
  "focusSessionsCount": ${data.focusSessions.length},
  "scheduleBlocksCount": ${data.scheduleBlocks.length}
	}`}
        </div>

        {!isMockTransport && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => window.location.assign("/api/v1/export")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium shadow-sm hover:opacity-90 transition-colors"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>下载 JSON 导出</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
