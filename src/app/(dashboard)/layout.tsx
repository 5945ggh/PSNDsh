"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { FocusTimerProvider } from "@/context/FocusTimerContext";
import { useData } from "@/context/MockContext";
import { FocusSplitModal } from "@/components/focus/FocusSplitModal";
import { FocusManualModal } from "@/components/focus/FocusManualModal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data, status } = useData();

  useEffect(() => {
    if (status === "ready" && !data.session?.user) {
      router.replace("/login");
    }
  }, [data.session?.user, router, status]);

  if (status === "loading") {
    return (
      <main className="min-h-screen grid place-items-center bg-zinc-50 text-sm text-zinc-500 dark:bg-zinc-950">
        正在恢复工作台...
      </main>
    );
  }

  if (!data.session?.user) {
    return null;
  }

  return (
    <FocusTimerProvider>
      <AppShell>{children}</AppShell>
      <FocusSplitModal />
      <FocusManualModal />
    </FocusTimerProvider>
  );
}
