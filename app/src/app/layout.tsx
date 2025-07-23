import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/WalletProvider";
import { NotificationProvider } from "@/components/Notifications";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Solana Escrow System",
  description: "A comprehensive escrow system for international trade on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <NotificationProvider>
          <WalletProvider>
            {children}
          </WalletProvider>
        </NotificationProvider>
      </body>
    </html>
  );
}
