"use client";

import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { FocusTimerProvider } from "@/context/FocusTimerContext";
import { FocusSplitModal } from "@/components/focus/FocusSplitModal";
import { FocusManualModal } from "@/components/focus/FocusManualModal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FocusTimerProvider>
      <AppShell>{children}</AppShell>
      <FocusSplitModal />
      <FocusManualModal />
    </FocusTimerProvider>
  );
}
