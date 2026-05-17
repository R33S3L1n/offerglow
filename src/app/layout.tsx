import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OfferGlow - 极简个人求职网页生成器",
  description:
    "扔掉死板的 PDF，将简历一键转化为极具质感的求职主页。支持图文混排、模块化编辑的专属个人网页。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
