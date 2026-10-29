import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Frame Studio", description: "A workspace for making video." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
