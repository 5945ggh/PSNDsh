"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useData } from "@/context/MockContext";
import { User, Lock, AlertCircle, ShieldOff, ArrowLeft } from "lucide-react";

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
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <div className="max-w-sm w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-xl text-center">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-4">
            <ShieldOff className="w-6 h-6" />
          </div>
          <h1 className="text-base font-semibold mb-1">注册不可用 (REGISTRATION_CLOSED)</h1>
          <p className="text-xs text-zinc-500 mb-6">
            根据此实例的系统安全策略，当前公开注册服务已被管理员关闭。
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-medium hover:opacity-90"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>返回登录</span>
          </Link>
        </div>
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
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="max-w-sm w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-xl">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold text-xl mb-3 shadow">
            P
          </div>
          <h1 className="text-xl font-semibold tracking-tight">注册新账号</h1>
          <p className="text-xs text-zinc-500 mt-1">仅需账号与密码，无需绑定社交信息</p>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4 text-xs">
          <div>
            <label htmlFor="register-username" className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              账号
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="text"
                id="register-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="设置登录账号"
                className="w-full pl-9 pr-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="register-password" className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              密码
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="password"
                id="register-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="密码至少 6 位"
                className="w-full pl-9 pr-3 py-2 border border-zinc-300 dark:border-zinc-700 rounded-md bg-transparent outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="register-password-confirmation" className="block font-medium mb-1 text-zinc-700 dark:text-zinc-300">
              确认密码
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
              <input
                type="password"
                id="register-password-confirmation"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
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
            <span>{pendingMutations > 0 ? "正在注册..." : "完成注册并进入"}</span>
          </button>
        </form>

        <div className="mt-6 border-t border-zinc-200 dark:border-zinc-800 pt-4 text-center text-xs text-zinc-500">
          已有账号？{" "}
          <Link
            href="/login"
            className="text-blue-600 dark:text-blue-400 font-medium hover:underline"
          >
            直接登录
          </Link>
        </div>
      </div>
    </div>
  );
}
