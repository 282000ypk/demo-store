import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCart, getCartItems, cartToCookieString } from "@/lib/cart";
import type { Cart } from "@/lib/types";

export async function GET() {
  const cart = getCart();
  const items = getCartItems(cart);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { gameId, action, quantity } = body as { gameId: number; action: "add" | "remove" | "update"; quantity?: number };

  const cookieStore = cookies();
  const raw = cookieStore.get("cart")?.value;
  let cart: Cart = {};
  try { cart = raw ? JSON.parse(raw) : {}; } catch { cart = {}; }

  const key = String(gameId);

  if (action === "add") {
    cart[key] = (cart[key] || 0) + 1;
  } else if (action === "remove") {
    delete cart[key];
  } else if (action === "update") {
    const qty = quantity ?? 1;
    if (qty <= 0) {
      delete cart[key];
    } else {
      cart[key] = qty;
    }
  }

  const response = NextResponse.json({ success: true, cart });
  response.cookies.set("cart", cartToCookieString(cart), {
    path: "/",
    httpOnly: false,
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
