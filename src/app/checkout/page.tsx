import { PHONEPE_MERCHANT_ID, SDK_DOMAIN } from "@/lib/phonepe";
import CheckoutClient from "./CheckoutClient";

export default function CheckoutPage() {
  return <CheckoutClient merchantId={PHONEPE_MERCHANT_ID} sdkDomain={SDK_DOMAIN} />;
}
