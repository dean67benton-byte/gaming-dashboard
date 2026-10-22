import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gaming Dashboard",
  description: "Your games, hours and stats in one place",
  appleWebApp: { capable: true, title: "Gaming", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#0c0d14" };

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
