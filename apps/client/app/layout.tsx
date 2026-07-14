import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import SessionProviderComponent from "@/components/session-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "sonner";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "DebtProof — Blockchain P2P Lending",
  description:
    "Decentralized peer-to-peer borrowing and lending platform. Create, manage, and settle IOUs securely on the blockchain.",
  keywords: ["blockchain", "P2P lending", "DeFi", "smart contracts", "IOU"],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <SessionProviderComponent>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </SessionProviderComponent>
      </body>
    </html>
  );
}
