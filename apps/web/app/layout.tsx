import type { Metadata, Viewport } from "next";
import { PwaProvider } from "@/components/PwaProvider";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIPSA Digital School",
  description: "Multi-Tenant School ERP & LMS by AIPSA",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "AIPSA" },
};

export const viewport: Viewport = {
  themeColor: "#1D7A4A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <PwaProvider />
      </body>
    </html>
  );
}
