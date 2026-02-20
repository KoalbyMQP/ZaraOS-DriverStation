import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/contexts/AuthContext";
import { ConnectionProvider } from "@/contexts/ConnectionContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <ProjectProvider>
            <ConnectionProvider>{children}</ConnectionProvider>
          </ProjectProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
