"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Database, Download, Info, KeyRound, Save, Tags, User } from "lucide-react";
import { useData } from "@/context/MockContext";
import { ApiKeyManager } from "@/components/settings/ApiKeyManager";
import { ExpenseDimensionManager } from "@/components/settings/ExpenseDimensionManager";
import { SettingsSectionNav, type SettingsSectionNavItem } from "@/components/settings/SettingsSectionNav";

type SettingsSectionId = "profile" | "api-keys" | "expense-fields" | "data-export";

const SETTINGS_SECTION_IDS: SettingsSectionId[] = ["profile", "api-keys", "expense-fields", "data-export"];

const getSectionFromHash = (): SettingsSectionId => {
  if (typeof window === "undefined") return "profile";
  const value = window.location.hash.replace(/^#/, "");
  return (SETTINGS_SECTION_IDS as string[]).includes(value) ? (value as SettingsSectionId) : "profile";
};

function SectionFrame({
  id,
  title,
  description,
  icon: Icon,
  children,
}: {
  id: SettingsSectionId;
  title: string;
  description: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <section
      role="tabpanel"
      aria-labelledby={`${id}-title`}
      className="overflow-hidden rounded-xl border border-zinc-200 bg-white/80 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70"
    >
      <div className="flex items-start gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {description}
          </p>
        </div>
      </div>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { api, data, isMockTransport, mutate, pendingMutations } = useData();
  const user = data.session?.user;

  const [nickname, setNickname] = useState(user?.nickname || "");
  const [email, setEmail] = useState(user?.email || "");
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("profile");

  useEffect(() => {
    const syncFromHash = () => {
      setActiveSection(getSectionFromHash());
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!SETTINGS_SECTION_IDS.includes(activeSection)) return;
    if (window.location.hash.replace(/^#/, "") !== activeSection) {
      window.history.replaceState(null, "", `#${activeSection}`);
    }
  }, [activeSection]);

  const sections = useMemo<SettingsSectionNavItem[]>(
    () => [
      {
        id: "profile",
        title: "个人资料",
        description: "账号、显示昵称、绑定邮箱",
        icon: User,
      },
      {
        id: "api-keys",
        title: "快捷指令 / API",
        description: isMockTransport ? "当前数据源保留入口，真实 key 管理待接入" : "创建、查看、撤销 API key",
        icon: KeyRound,
      },
      {
        id: "expense-fields",
        title: "账目字段",
        description: "分类、支付方式、标签统一管理",
        icon: Tags,
      },
      {
        id: "data-export",
        title: "数据与导出",
        description: "JSON 导出与数据范围说明",
        icon: Database,
      },
    ],
    [isMockTransport]
  );

  const selectSection = (section: string) => {
    const nextSection = SETTINGS_SECTION_IDS.includes(section as SettingsSectionId)
      ? (section as SettingsSectionId)
      : "profile";
    setActiveSection(nextSection);
    if (window.location.hash.replace(/^#/, "") !== nextSection) {
      window.location.hash = nextSection;
    }
  };

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
    <div className="mx-auto w-full max-w-[90rem] px-4 py-6 md:px-8 md:py-8">
      <div className="space-y-6">
        <header className="max-w-3xl space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">设置</h1>
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            管理个人资料、快捷指令凭据和数据导出。
          </p>
        </header>

        <div className="grid gap-5 lg:grid-cols-[13rem_minmax(0,1fr)] xl:gap-6">
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <SettingsSectionNav items={sections} activeId={activeSection} onSelect={selectSection} />
          </aside>

          <main className="min-w-0">
            {activeSection === "profile" && (
              <SectionFrame
                id="profile"
                title="个人资料"
                description="账号信息只读，昵称和绑定邮箱可修改。"
                icon={User}
              >
                <form onSubmit={handleSaveProfile} className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)] md:gap-x-6 md:gap-y-5">
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
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">账号不可编辑。</p>
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
                        className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:focus:border-zinc-400"
                      />
                      <p className="text-xs text-zinc-500 dark:text-zinc-500">会显示在首页和资料区。</p>
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
                        className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:focus:border-zinc-400"
                      />
                      <div className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>邮箱仅作联系标志，不做校验，也不用于找回密码。</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
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
              </SectionFrame>
            )}

            {activeSection === "api-keys" &&
              (isMockTransport ? (
                <SectionFrame
                  id="api-keys"
                  title="快捷指令 / API"
                  description="为 iPhone 快捷指令和其他自动化流程创建独立凭据。"
                  icon={KeyRound}
                >
                  <div className="rounded-lg border border-dashed border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
                    <div className="flex items-start gap-3">
                      <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden="true" />
                      <div>
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                          当前数据源保留了入口位置
                        </p>
                        <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                          真实的 API key 创建、查看和撤销在接入后端时显示；页面结构和导航会保持不变。
                        </p>
                      </div>
                    </div>
                  </div>
                </SectionFrame>
              ) : (
                <ApiKeyManager />
              ))}

            {activeSection === "expense-fields" && <ExpenseDimensionManager />}

            {activeSection === "data-export" && (
              <SectionFrame
                id="data-export"
                title="数据与导出"
                description="查看当前导出包含的数据范围，并下载本账号 JSON 或账目 CSV 导出。"
                icon={Database}
              >
                <div className="space-y-4">
                  <p className="max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    JSON 导出包含当前账号资料、条目、周计划、日程、专注会话和片段，以及账目与账目字典；CSV 导出只包含账目域。不含密码、会话和服务端密钥。
                  </p>

                  <pre className="overflow-x-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-[11px] leading-5 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                    {`{
  "schemaVersion": "1.1",
  "exportedAt": "2026-06-26T10:00:00Z",
  "profile": { "username": "${user?.username}" },
  "entriesCount": ${data.entries.length},
  "focusSessionsCount": ${data.focusSessions.length},
  "scheduleBlocksCount": ${data.scheduleBlocks.length}
}`}
                  </pre>

                  {!isMockTransport && (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => window.location.assign("/api/v1/export")}
                        className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>下载 JSON 导出</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => window.location.assign("/api/v1/expenses/export/csv")}
                        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>下载账目 CSV</span>
                      </button>
                    </div>
                  )}
                </div>
              </SectionFrame>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
