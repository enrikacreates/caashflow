import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CAASHFLOW - Budget System",
  description: "Smart budget management for your household",
  // iOS home-screen bookmark support — pairs with /app/apple-icon.png (180x180).
  // Next.js auto-emits <link rel="apple-touch-icon" ...> from that file plus
  // the appleWebApp config below for the standalone-app meta tags.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Caashflow",
  },
  // Next emits `mobile-web-app-capable` from appleWebApp.capable; older iOS
  // versions also read the apple-prefixed form, so emit both for safety.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
