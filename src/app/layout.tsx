import type { Metadata } from "next";
import "./globals.css";
import { MockProvider } from "@/context/MockContext";

export const metadata: Metadata = {
  title: "Personal Dashboard - 个人面板",
  description: "安静、清醒、可信的个人时间与意图管理面板",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <MockProvider>
          {children}
        </MockProvider>
      </body>
    </html>
  );
}
