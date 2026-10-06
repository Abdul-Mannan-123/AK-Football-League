import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AK Football League",
  description: "The official home of AK Football League.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
