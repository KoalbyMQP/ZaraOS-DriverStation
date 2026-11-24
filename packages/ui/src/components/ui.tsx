import type { ComponentProps } from "react";
import { Geist, Inter, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "../styles/globals.css";
import { cn } from "../lib/utils";

const fontInterface = Inter({ subsets: ["latin"], variable: "--font-inter" });

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const fontSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});

export function UI({ children, className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        fontInterface.variable,
        fontSans.variable,
        fontSerif.variable,
        fontMono.variable,
        "font-sans antialiased",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
