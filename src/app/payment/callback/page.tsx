import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { checkPaymentStatus } from "@/lib/phonepe";

interface CallbackPageProps {
  searchParams: { merchant_order_id?: string };
}

export default async function PaymentCallbackPage({ searchParams }: CallbackPageProps) {
  const merchantOrderId = searchParams.merchant_order_id;

  if (!merchantOrderId) {
    redirect("/shop?msg=No+order+found&type=error");
  }

  const { data } = await checkPaymentStatus(merchantOrderId);
  const state = (data as { state?: string })?.state || "UNKNOWN";

  if (state === "COMPLETED") {
    // Clear cart
    const cookieStore = cookies();
    const existingCart = cookieStore.get("cart");
    if (existingCart) {
      // We need to clear it — set via response. Since this is a server component
      // that redirects, we use the redirect and clear via the cart API
    }
  }

  const msg =
    state === "COMPLETED"
      ? `Payment successful! Order ${merchantOrderId} confirmed.`
      : state === "PENDING"
      ? `Payment is still pending for order ${merchantOrderId}.`
      : `Payment failed for order ${merchantOrderId}. State: ${state}`;

  const type =
    state === "COMPLETED" ? "success" : state === "PENDING" ? "info" : "error";

  redirect(`/order-result?state=${state}&orderId=${merchantOrderId}&msg=${encodeURIComponent(msg)}&type=${type}`);
}
