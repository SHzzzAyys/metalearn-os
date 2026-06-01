import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "费曼坊 | MetaLearn Suite",
  description: "解释、追问、漏洞暴露和卡片交接。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
