import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VMS Gate Kiosk",
  description: "Visitor & worker gate check-in kiosk",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body suppressHydrationWarning>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
          {children}
        </div>
      </body>
    </html>
  );
}
