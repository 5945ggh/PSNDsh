"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useData } from "@/context/MockContext";
import { User, Lock, AlertCircle, ArrowRight } from "lucide-react";

const pageShellClass =
  "min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100";
const pageInnerClass = "mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-8 sm:py-12";
const surfaceClass = "w-full space-y-5";
const panelClass =
  "rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-5";
const brandClass =
  "inline-flex items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400";
const eyebrowClass = "flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500";
const titleClass = "text-lg font-semibold tracking-tight";
const descriptionClass = "text-sm leading-6 text-zinc-600 dark:text-zinc-400";
const labelClass = "block text-xs font-medium text-zinc-600 dark:text-zinc-400";
const inputShellClass = "relative";
const inputIconClass = "absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400";
const inputClass =
  "w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 pl-9 text-sm text-zinc-900 placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-zinc-700 dark:text-zinc-100";
const errorClass =
  "flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300";
const primaryButtonClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2.5 text-xs font-medium text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-60";
const footerClass =
  "border-t border-zinc-200 pt-4 text-center text-xs text-zinc-500 dark:border-zinc-800";

export default function LoginPage() {
  const router = useRouter();
  const { api, data, mutate, pendingMutations, status } = useData();
  const capabilities = data.capabilities;

  const [username, setUsername] = useState("ningcc");
  const [password, setPassword] = useState("password123");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (status === "ready" && data.session.user) router.replace("/");
  }, [data.session.user, router, status]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      await mutate(() => api.login({ username, password }));
      router.push("/");
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : "INVALID_CREDENTIALS: 账号或密码不正确");
    }
  };

  return (
    <div className={pageShellClass}>
      <main className={pageInnerClass}>
        <section className={surfaceClass}>
          <div className="space-y-2">
            <div className={eyebrowClass}>
              <span className={brandClass}>Personal Dash</span>
              <span>登录</span>
            </div>
            <h1 className={titleClass}>进入工作台</h1>
            <p className={descriptionClass}>用账号和密码进入当前实例。</p>
          </div>

          <div className={panelClass}>
            {errorMsg && (
              <div className={errorClass} role="alert" aria-live="polite">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label htmlFor="login-username" className={labelClass}>
                  账号
                </label>
                <div className={inputShellClass}>
                  <User className={inputIconClass} aria-hidden="true" />
                  <input
                    type="text"
                    id="login-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="login-password" className={labelClass}>
                  密码
                </label>
                <div className={inputShellClass}>
                  <Lock className={inputIconClass} aria-hidden="true" />
                  <input
                    type="password"
                    id="login-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <button type="submit" disabled={pendingMutations > 0} className={primaryButtonClass}>
                <span>{pendingMutations > 0 ? "正在登录..." : "直接登录"}</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </form>
          </div>

          {capabilities?.registration.available ? (
            <div className={footerClass}>
              还没有账号？{" "}
              <Link href="/register" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                前往注册
              </Link>
            </div>
          ) : (
            <div className={footerClass}>
              当前实例已关闭公开注册
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
