import { NextResponse } from "next/server";
import { checkPaymentStatus } from "@/lib/phonepe";

export async function GET(
  _request: Request,
  { params }: { params: { merchantOrderId: string } }
) {
  const { merchantOrderId } = params;
  const { data, logs } = await checkPaymentStatus(merchantOrderId);

  const state = (data as { state?: string })?.state || "UNKNOWN";

  const response = NextResponse.json({ state, logs });

  if (state === "COMPLETED") {
    // Clear cart cookie
    response.cookies.set("cart", "", { path: "/", maxAge: 0 });
  }

  return response;
}
