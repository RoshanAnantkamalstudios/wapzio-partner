import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wapzio Partner Panel",
  description: "Onboard and manage your Wapzio client accounts.",
  // A reseller's back office has nothing to gain from search indexing.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Browser extensions (ColorZilla etc.) inject attributes onto <body> before hydration. */}
      <body suppressHydrationWarning>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
