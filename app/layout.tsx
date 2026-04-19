import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CT-AGENT V1",
  description: "Critical thinking teaching assistant prototype",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
