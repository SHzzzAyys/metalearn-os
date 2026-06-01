import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "校准记忆 | MetaLearn Suite",
  description: "主动提取、信心校准和本地优先复习队列。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
