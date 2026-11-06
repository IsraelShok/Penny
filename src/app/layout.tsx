import type { Metadata } from "next";
import { Inter, Geist_Mono, Heebo } from "next/font/google";
import { getLocale, getMessages } from "next-intl/server";
import { cookies } from "next/headers";
import { SidebarRoot } from "@/components/layout/app-shell";
import { I18nProvider } from "@/i18n/client-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { QueryProvider } from "@/components/query-provider";
import { dirFor, isLocale, defaultLocale } from "@/i18n/routing";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Hebrew UI font; globals.css points the font variables at it under lang="he".
const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Penny",
  description: "Personal finance tracker with AI-powered categorization",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const rawLocale = await getLocale();
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const messages = await getMessages();
  const dir = dirFor(locale);
  // Set by the sidebar's collapse button.
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";
  return (
    <html
      lang={locale}
      dir={dir}
      className={`${inter.variable} ${heebo.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale} messages={messages as Record<string, unknown>}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <QueryProvider>
              <TooltipProvider>
                <SidebarRoot defaultOpen={sidebarOpen}>{children}</SidebarRoot>
                <Toaster />
              </TooltipProvider>
            </QueryProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
