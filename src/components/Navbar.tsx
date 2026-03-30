import Link from "next/link";

interface NavbarProps {
  cartCount: number;
}

export default function Navbar({ cartCount }: NavbarProps) {
  return (
    <nav className="navbar">
      <Link href="/shop" className="logo">🎮 PS5 Game Shop</Link>
      <div className="nav-links">
        <Link href="/shop">Shop</Link>
        <Link href="/api-logs">📋 API Logs</Link>
        <Link href="/cart" className="cart-link">
          🛒 Cart
          {cartCount > 0 && <span className="badge">{cartCount}</span>}
        </Link>
      </div>
    </nav>
  );
}
