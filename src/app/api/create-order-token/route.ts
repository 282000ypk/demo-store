import { NextResponse } from "next/server";
import { getCart, getCartItems } from "@/lib/cart";
import { createOrderToken } from "@/lib/phonepe";

function generateOrderId(): string {
  return `PS5-${Math.random().toString(36).substring(2, 14).toUpperCase()}`;
}

export async function POST() {
  const cart = getCart();
  const items = getCartItems(cart);

  if (items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const total = items.reduce((sum, i) => sum + i.subtotal, 0);
  const amountPaisa = total * 100;
  const merchantOrderId = generateOrderId();

  const { data, logs } = await createOrderToken(amountPaisa, merchantOrderId);

  if (data && typeof data === "object" && "token" in data) {
    return NextResponse.json({
      transactionToken: (data as { token: string }).token,
      merchantOrderId,
      logs,
    });
  }

  return NextResponse.json({ error: "Order token creation failed", logs }, { status: 500 });
}
