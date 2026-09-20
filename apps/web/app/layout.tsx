import type { Metadata, Viewport } from "next";
import "./globals.css";
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#2B5C4B" };

export const metadata: Metadata = {
  title: "听页 · 听见书中的世界",
  description: "导入你的书，跟随声音阅读。多格式书籍导入、句子高亮、自动翻页与自定义 TTS 语音。",
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
    <html lang="zh-CN">

      <body className="antialiased">{children}</body>
    </html>
  );
}
