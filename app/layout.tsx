import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  return {
    metadataBase,
    title: {
      default: "BiteMap NOVA — Fishing intelligence for Northern Virginia",
      template: "%s · BiteMap NOVA",
    },
    description:
      "Evidence-led freshwater fishing opportunities, conditions, access, and transparent confidence for Northern Virginia.",
    applicationName: "BiteMap NOVA",
    keywords: ["Northern Virginia fishing", "fishing conditions", "Virginia DWR", "USGS water data"],
    openGraph: {
      title: "BiteMap NOVA",
      description: "Know where the next bite starts.",
      type: "website",
      images: [{ url: "/og.png", width: 1536, height: 1024, alt: "BiteMap NOVA — Know where the next bite starts." }],
    },
    twitter: {
      card: "summary_large_image",
      title: "BiteMap NOVA",
      description: "Know where the next bite starts.",
      images: ["/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
