import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CT-AGENT · 教育心理学",
  description: "教育心理学课程学习脚手架：理解、修订、迁移与反思。",
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
