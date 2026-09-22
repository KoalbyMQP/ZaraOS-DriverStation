import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import MsalWrapper from "@/components/MsalWrapper";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import "./globals.css";

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
            <AuthProvider>{children}</AuthProvider>
          </ThemeProvider>
        </MsalWrapper>
      </body>
    </html>
  );
}
