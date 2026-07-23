"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useData } from "@/context/MockContext";
import { User, Lock, AlertCircle, ArrowRight } from "lucide-react";

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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="max-w-sm w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-xl">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold text-xl mb-3 shadow">
            P
          </div>
          <h1 className="text-xl font-semibold tracking-tight">登录 Personal Dash</h1>
          <p className="text-xs text-zinc-500 mt-1">进入个人专注与意图管理面板</p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4 text-xs">
          <div>
            <label htmlFor="login-username" className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              账号
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="text"
                id="login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              密码
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="password"
                id="login-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={pendingMutations > 0}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 font-medium text-xs transition-colors shadow-sm"
          >
            <span>{pendingMutations > 0 ? "正在登录..." : "直接登录"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {capabilities?.registration.available ? (
          <div className="mt-6 border-t border-zinc-200 dark:border-zinc-800 pt-4 text-center text-xs text-zinc-500">
            还没有账号？{" "}
            <Link
              href="/register"
              className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
            >
              前往注册
            </Link>
          </div>
        ) : (
          <div className="mt-6 border-t border-zinc-200 dark:border-zinc-800 pt-4 text-center text-xs text-zinc-400">
            当前实例已关闭公开注册
          </div>
        )}
      </div>
    </div>
  );
}
