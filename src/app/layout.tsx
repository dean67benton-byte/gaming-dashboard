import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gaming Dashboard",
  description: "Your games, hours and stats in one place",
};

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
