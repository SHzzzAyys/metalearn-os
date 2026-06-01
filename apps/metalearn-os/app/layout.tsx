import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MetaLearn OS",
  description: "把真实学习材料转化为提取、解释、复习和校准洞察。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
