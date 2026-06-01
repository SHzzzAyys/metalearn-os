import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "学习罗盘 | MetaLearn Suite",
  description: "轻量计划、学习反思和校准仪表盘。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
