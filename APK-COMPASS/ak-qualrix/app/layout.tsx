import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AmbientGlow } from "@/components/ui/AmbientGlow";
import { Toaster } from "sonner";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "ComPass",
  description: "Consultant Management Platform & Success System",
  icons: {
    icon: "/favicon.ico",
    apple: "/compass_icon_192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('compass-theme');if(t==='qualrix')document.documentElement.classList.add('theme-qualrix');else if(t==='b2bnetwork')document.documentElement.classList.add('theme-b2bnetwork');}catch(e){}})()` }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <AmbientGlow />
        {children}
        <Toaster richColors position="bottom-right" />
      </body>
    </html>
  );
}
