import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Vela — Academic Navigator",
  description: "Student performance monitoring powered by Canvas LMS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} bg-[#03060D] text-[#E8ECFF] antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
