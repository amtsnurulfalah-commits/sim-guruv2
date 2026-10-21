import type { ReactNode } from "react";
import "../../../src/app/globals.css";
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
