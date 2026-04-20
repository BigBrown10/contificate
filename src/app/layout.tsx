import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JINTA Content Engine",
  description:
    "Generate TikTok-ready slide images automatically. Type a keyword, get a batch of downloadable slides in under 2 minutes.",
  robots: "noindex, nofollow", // Internal tool
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
