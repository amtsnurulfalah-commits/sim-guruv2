import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ToastRegion } from "@/components/feedback/toast-region";
export const metadata: Metadata = {
  title: { default: "SiM-Guru — Ruang Kerja Guru", template: "%s | SiM-Guru" },
  description: "Sistem informasi kegiatan dan administrasi guru madrasah.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <a
          href="#konten-utama"
          className="sr-only z-50 rounded bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Lewati ke konten utama
        </a>
        {children}
        <ToastRegion />
      </body>
    </html>
  );
}
