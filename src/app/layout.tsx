import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { getCart, getCartCount } from "@/lib/cart";

export const metadata: Metadata = {
  title: "PS5 Game Shop",
  description: "Demo PS5 game store with PhonePe payment integration",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cart = getCart();
  const cartCount = getCartCount(cart);

  return (
    <html lang="en">
      <body>
        <Navbar cartCount={cartCount} />
        <main className="container">{children}</main>
        <footer className="footer">
          <p>PS5 Game Shop — PhonePe Payment Gateway Demo</p>
        </footer>
      </body>
    </html>
  );
}
