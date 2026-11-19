import type { Metadata } from "next";
import { UI } from "@repo/ui/components/ui";

import "./globals.css";

export const metadata: Metadata = {
  title: "Driver Station",
  description: "Driver Station for controlling robot running ZaraOS",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <UI>{children}</UI>
      </body>
    </html>
  );
}
