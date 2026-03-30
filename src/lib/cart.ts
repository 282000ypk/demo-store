import { cookies } from "next/headers";
import { GAMES } from "./games";
import type { Cart, CartItem } from "./types";

const CART_COOKIE = "cart";

export function getCart(): Cart {
  const cookieStore = cookies();
  const raw = cookieStore.get(CART_COOKIE)?.value;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Cart;
  } catch {
    return {};
  }
}

export function cartToCookieString(cart: Cart): string {
  return JSON.stringify(cart);
}

export function getCartItems(cart: Cart): CartItem[] {
  return Object.entries(cart)
    .map(([gidStr, qty]) => {
      const game = GAMES.find((g) => g.id === parseInt(gidStr));
      if (!game) return null;
      return { ...game, quantity: qty, subtotal: game.price * qty };
    })
    .filter((item): item is CartItem => item !== null);
}

export function getCartCount(cart: Cart): number {
  return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
}
