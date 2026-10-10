import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "教育心理学 · 课程学习空间",
  description: "教育心理学课程学习空间。完成学习任务，回看解释、修订、迁移与反思。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
