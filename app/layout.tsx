import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mac OS 9 — Platinum",
  description: "The classic Macintosh desktop, recreated for your browser. Finder, SimpleText, Sherlock, Stickies, QuickTime, and more.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
