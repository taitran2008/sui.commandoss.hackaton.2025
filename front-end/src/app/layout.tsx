import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SuiProvider from '@/components/SuiProvider';
import { ToastProvider } from '@/components/ToastProvider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SUI Task Management System",
  description: "A comprehensive task management system built for the SUI blockchain ecosystem",
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
        <SuiProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </SuiProvider>
      </body>
    </html>
  );
}
