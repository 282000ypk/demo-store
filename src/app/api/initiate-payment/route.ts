import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { getCart, getCartItems } from "@/lib/cart";
import { initiatePayment } from "@/lib/phonepe";
import { v4 as uuidv4 } from "uuid";

// Inline uuid generation since we can't add dependencies mid-build
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

  const headersList = headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const redirectUrl = `${protocol}://${host}/payment/callback?merchant_order_id=${merchantOrderId}`;

  const { data, logs } = await initiatePayment(amountPaisa, merchantOrderId, redirectUrl);

  if (data && typeof data === "object" && "redirectUrl" in data) {
    return NextResponse.json({
      tokenUrl: (data as { redirectUrl: string }).redirectUrl,
      merchantOrderId,
      logs,
    });
  }

  return NextResponse.json({ error: "Payment initiation failed", logs }, { status: 500 });
}
