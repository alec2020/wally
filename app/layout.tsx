import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { ScreenshotModeProvider } from "@/lib/screenshot-mode";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Finance Tracker",
  description: "Personal finance tracking and analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${plusJakarta.variable} ${ibmPlexMono.variable} ${spaceGrotesk.variable} font-sans antialiased`}
      >
        <ScreenshotModeProvider>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto bg-background">
              {children}
            </main>
          </div>
        </ScreenshotModeProvider>
      </body>
    </html>
  );
}
