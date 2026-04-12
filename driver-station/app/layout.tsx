import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import MsalWrapper from "@/components/MsalWrapper";
import ConnectionHealthMonitor from "@/components/ConnectionHealthMonitor";
import { ConnectionProvider } from "@/contexts/ConnectionContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import "./globals.css";
import {AuthProvider} from "@/contexts/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Driver Station",
  description: "Driver Station for controlling robot running ZaraOS",
};

const themeInitScript = `
  (() => {
    try {
      const storageKey = "driver-station-theme";
      const storedTheme = window.localStorage.getItem(storageKey);
      const theme =
        storedTheme === "light" || storedTheme === "dark"
          ? storedTheme
          : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.dataset.theme = theme;
    } catch {
      document.documentElement.dataset.theme = "dark";
    }
  })();
`;

export default function RootLayout({
                                     children,
                                   }: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
      <MsalWrapper>
          <ThemeProvider>
          <AuthProvider>
            <ConnectionProvider>
              <ProjectProvider>
              <ConnectionHealthMonitor />
              {children}
            </ProjectProvider>
            </ConnectionProvider>
          </AuthProvider>
          </ThemeProvider>
      </MsalWrapper>
      </body>
      </html>
  );
}