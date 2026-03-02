import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Accountable — Geographic Mismatch Analysis",
  description: "Who really funds America's tax-writing committees?",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Oswald:wght@700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-stone-50">
        <Nav />
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-12">
          {children}
        </main>
        <footer className="border-t border-[#C8C1B6]/30 mt-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-stone-400">
              FEC individual &amp; PAC contribution data, 2024 cycle.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="/methodology"
                className="text-xs text-stone-400 hover:text-[#111111] transition-colors uppercase tracking-wide"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Methodology
              </a>
              <a
                href="/stories"
                className="text-xs text-stone-400 hover:text-[#111111] transition-colors uppercase tracking-wide"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Story Hooks
              </a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
