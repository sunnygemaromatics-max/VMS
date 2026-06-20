import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n";
import { ToastProvider } from "@vms/ui";
import { BrandFooter } from "@/components/brand-footer";
import { NotificationToaster } from "@/components/notification-toaster";
import { SosBanner } from "@/components/sos-banner";
import { getBrand } from "@/lib/brand";
import { ThemeProvider, THEME_BOOTSTRAP_SCRIPT } from "@/lib/theme-context";

const brand = getBrand();

export const metadata: Metadata = {
  title: brand.productName + " | Gem Aromatics Group",
  description: brand.description,
  authors: [{ name: "Gem Aromatics Group" }],
  openGraph: {
    title: brand.ogTitle,
    description: brand.description,
    type: "website",
    siteName: brand.shortName + " · " + brand.tagline,
  },
  icons: { icon: brand.faviconSrc },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-density="compact" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="stylesheet"
          href="https://rsms.me/inter/inter.css"
        />
      </head>
      <body suppressHydrationWarning className="bg-surface-0 text-text-primary">
        <ThemeProvider>
          <I18nProvider>
            <ToastProvider>
              <AuthProvider>
              <div className="relative min-h-screen flex flex-col bg-surface-0 text-text-primary overflow-x-hidden">
                {/* Ambient brand backdrop — opacity tuned for both themes */}
                <div
                  aria-hidden
                  className="pointer-events-none fixed inset-0 z-0 bg-brand-radial opacity-100 dark:opacity-100"
                />
                <div
                  aria-hidden
                  className="pointer-events-none fixed inset-x-0 top-0 h-px bg-brand-gradient z-50"
                />
                <div className="relative z-10 flex-1">{children}</div>
                <BrandFooter />
              </div>
              <SosBanner />
              <NotificationToaster />
              </AuthProvider>
            </ToastProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
