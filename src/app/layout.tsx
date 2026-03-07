import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "nQ-Swap | Real-Time DEX Pool Monitor",
  description: "Real-time monitoring dashboard for nQ-Swap decentralized exchange pools. Live candlestick charts with WebSocket price feeds and RPC block confirmation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
