import Link from "next/link";
import Image from "next/image";
import { getCart, getCartItems } from "@/lib/cart";
import CartActions from "./CartActions";

interface CartPageProps {
  searchParams: { msg?: string; type?: string };
}

export default function CartPage({ searchParams }: CartPageProps) {
  const cart = getCart();
  const items = getCartItems(cart);
  const total = items.reduce((sum, i) => sum + i.subtotal, 0);
  const { msg, type } = searchParams;

  if (items.length === 0) {
    return (
      <>
        <h1>Your Cart</h1>
        {msg && <div className={`alert alert-${type || "info"}`}>{msg}</div>}
        <div className="empty-cart">
          <p>Your cart is empty.</p>
          <Link href="/shop" className="btn btn-primary">Browse Games</Link>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>Your Cart</h1>
      {msg && <div className={`alert alert-${type || "info"}`}>{msg}</div>}
      <table className="cart-table">
        <thead>
          <tr>
            <th>Game</th>
            <th>Price</th>
            <th>Quantity</th>
            <th>Subtotal</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <div className="cart-game">
                  <Image
                    src={item.image}
                    alt={item.title}
                    width={50}
                    height={65}
                    className="cart-thumb"
                    style={{ objectFit: "cover", borderRadius: "6px" }}
                  />
                  <span>{item.title}</span>
                </div>
              </td>
              <td>₹{item.price}</td>
              <td>
                <CartActions gameId={item.id} quantity={item.quantity} />
              </td>
              <td>₹{item.subtotal}</td>
              <td>
                <CartActions gameId={item.id} quantity={item.quantity} action="remove" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cart-summary">
        <p className="total"><strong>Total: ₹{total}</strong></p>
        <div className="cart-actions">
          <Link href="/shop" className="btn btn-secondary">Continue Shopping</Link>
          <Link href="/checkout" className="btn btn-primary">Proceed to Checkout</Link>
        </div>
      </div>
    </>
  );
}
