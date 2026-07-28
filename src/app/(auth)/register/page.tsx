"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useData } from "@/context/MockContext";
import { User, Lock, AlertCircle, ShieldOff, ArrowLeft } from "lucide-react";

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
const secondaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-zinc-900 px-3.5 py-2.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";
const warningClass =
  "flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200";

export default function RegisterPage() {
  const router = useRouter();
  const { api, data, mutate, pendingMutations, status } = useData();
  const capabilities = data.capabilities;

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (status === "ready" && data.session.user) router.replace("/");
  }, [data.session.user, router, status]);

  if (status === "ready" && capabilities && !capabilities.registration.available) {
    return (
      <div className={pageShellClass}>
        <main className={pageInnerClass}>
          <section className={surfaceClass}>
            <div className="space-y-2">
              <div className={eyebrowClass}>
                <span className={brandClass}>Personal Dash</span>
                <span>注册</span>
              </div>
              <h1 className={titleClass}>注册已关闭</h1>
              <p className={descriptionClass}>当前实例不接受新的公开注册。</p>
            </div>

            <div className={panelClass}>
              <div className={warningClass} role="status" aria-live="polite">
                <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                <div className="space-y-1">
                  <p className="font-medium">REGISTRATION_CLOSED</p>
                  <p>根据此实例的系统安全策略，公开注册已关闭。</p>
                </div>
              </div>

              <div className="pt-4">
                <Link href="/login" className={secondaryButtonClass}>
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>返回登录</span>
                </Link>
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      await mutate(() => api.register({ username, password, passwordConfirmation: confirmPassword }));
      router.push("/");
    } catch (error: unknown) {
      setErrorMsg(error instanceof Error ? error.message : "注册失败");
    }
  };

  return (
    <div className={pageShellClass}>
      <main className={pageInnerClass}>
        <section className={surfaceClass}>
          <div className="space-y-2">
            <div className={eyebrowClass}>
              <span className={brandClass}>Personal Dash</span>
              <span>注册</span>
            </div>
            <h1 className={titleClass}>创建账号</h1>
            <p className={descriptionClass}>只需要账号、密码和确认密码。</p>
          </div>

          <div className={panelClass}>
            {errorMsg && (
              <div className={errorClass} role="alert" aria-live="polite">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label htmlFor="register-username" className={labelClass}>
                  账号
                </label>
                <div className={inputShellClass}>
                  <User className={inputIconClass} aria-hidden="true" />
                  <input
                    type="text"
                    id="register-username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="设置登录账号"
                    autoComplete="username"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="register-password" className={labelClass}>
                  密码
                </label>
                <div className={inputShellClass}>
                  <Lock className={inputIconClass} aria-hidden="true" />
                  <input
                    type="password"
                    id="register-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="密码至少 6 位"
                    autoComplete="new-password"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="register-password-confirmation" className={labelClass}>
                  确认密码
                </label>
                <div className={inputShellClass}>
                  <Lock className={inputIconClass} aria-hidden="true" />
                  <input
                    type="password"
                    id="register-password-confirmation"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入密码"
                    autoComplete="new-password"
                    className={inputClass}
                    required
                  />
                </div>
              </div>

              <button type="submit" disabled={pendingMutations > 0} className={primaryButtonClass}>
                <span>{pendingMutations > 0 ? "正在注册..." : "完成注册并进入"}</span>
              </button>
            </form>
          </div>

          <div className={footerClass}>
            已有账号？{" "}
            <Link href="/login" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
              直接登录
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
