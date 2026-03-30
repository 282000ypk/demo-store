'use client';

import { useEffect, useRef, useState, useCallback } from "react";
import Script from "next/script";
import Link from "next/link";
import type { CartItem, ApiLog } from "@/lib/types";

declare global {
  interface Window {
    PhonepeWidget?: {
      init: (config: unknown) => void;
      pay: (config: { transactionToken: string; callback: (response: unknown) => void }) => void;
    };
    PhonePeCheckout?: {
      transact: (config: { tokenUrl: string; type: string; callback: (response: unknown) => void }) => void;
    };
  }
}

interface CheckoutClientProps {
  merchantId: string;
  sdkDomain: string;
}

export default function CheckoutClient({ merchantId, sdkDomain }: CheckoutClientProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<"card" | "other">("card");
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [payStatus, setPayStatus] = useState<{ msg: string; type: string } | null>(null);
  const [cardBtnText, setCardBtnText] = useState("");
  const [cardBtnDisabled, setCardBtnDisabled] = useState(false);
  const [otherBtnText, setOtherBtnText] = useState("");
  const [otherBtnDisabled, setOtherBtnDisabled] = useState(false);
  const [showCardBtn, setShowCardBtn] = useState(true);
  const [showOtherBtn, setShowOtherBtn] = useState(true);
  const [cardPanelError, setCardPanelError] = useState<string | null>(null);
  const sdkReadyRef = useRef(false);

  useEffect(() => {
    fetch("/api/cart")
      .then((r) => r.json())
      .then((data) => {
        const cartItems: CartItem[] = data.items || [];
        setItems(cartItems);
        const t = cartItems.reduce((sum: number, i: CartItem) => sum + i.subtotal, 0);
        setTotal(t);
        setCardBtnText(`Pay ₹${t} with Card`);
        setOtherBtnText(`Pay ₹${t} with PhonePe`);
      });
  }, []);

  const initCardSdk = useCallback(() => {
    try {
      if (window.PhonepeWidget) {
        const inputStyles = {
          outline: "none",
          border: "1px solid #3f3f46",
          padding: "8px 16px",
          height: "42px",
          background: "#ffffff",
          color: "#111111",
          fontSize: "14px",
          borderRadius: "8px",
          width: "100%",
          boxSizing: "border-box",
        };
        window.PhonepeWidget.init({
          layoutConfig: {
            formId: "cardForm",
            styles: { input: inputStyles },
            iframeContainers: {
              cardNumber: { container: "#cardNumberDiv", attributes: { placeholder: "Card Number" } },
              cardHolderName: { container: "#cardHolderNameDiv", attributes: { placeholder: "Name on Card" } },
              cardExpiry: { container: "#cardExpiryDiv", attributes: { placeholder: "MM / YY" } },
              cardCvv: { container: "#cardCvvDiv", attributes: { placeholder: "CVV" } },
            },
          },
          callback: (eventData: unknown) => {
            console.log("Card SDK event:", eventData);
            const ed = eventData as { currentElement?: string; error?: string };
            if (ed && ed.currentElement) {
              const errMap: Record<string, string> = {
                cardNumber: "cardNumberError",
                cardHolderName: "cardHolderNameError",
                cardExpiry: "cardExpiryError",
                cardCvv: "cardCvvError",
              };
              Object.values(errMap).forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.textContent = "";
              });
              const errEl = document.getElementById(errMap[ed.currentElement]);
              if (errEl && ed.error) errEl.textContent = ed.error;
              setCardBtnDisabled(false);
              setCardBtnText(`Pay ₹${total} with Card`);
            }
          },
        });
        sdkReadyRef.current = true;
        console.log("Card SDK initialized successfully");
      } else {
        console.warn("PhonepeWidget not available yet");
      }
    } catch (e) {
      console.warn("Card SDK init failed:", e);
      setCardPanelError(`Card SDK failed to load: ${(e as Error).message}`);
    }
  }, [total]);

  function handleCardSdkLoad() {
    initCardSdk();
    if (!sdkReadyRef.current) {
      setTimeout(initCardSdk, 1500);
      setTimeout(() => { if (!sdkReadyRef.current) initCardSdk(); }, 3000);
    }
  }

  async function initiateCardPayment() {
    setCardBtnDisabled(true);
    setCardBtnText("Creating order…");
    setPayStatus(null);

    try {
      const r = await fetch("/api/create-order-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json();
      const newLogs: ApiLog[] = data.logs || [];
      setLogs(newLogs);

      if (data.error) {
        setCardBtnDisabled(false);
        setCardBtnText(`Pay ₹${total} with Card`);
        setPayStatus({ msg: data.error, type: "error" });
        return;
      }

      setCardBtnText("Processing…");
      const merchantOrderId: string = data.merchantOrderId;

      if (!sdkReadyRef.current || !window.PhonepeWidget) {
        setPayStatus({ msg: "Card SDK not loaded. Please refresh the page.", type: "error" });
        setCardBtnDisabled(false);
        setCardBtnText(`Pay ₹${total} with Card`);
        return;
      }

      window.PhonepeWidget.pay({
        transactionToken: data.transactionToken,
        callback: async (response: unknown) => {
          console.log("Card pay response:", response);

          const sdkLog: ApiLog = {
            step: "3. Card Pay (SDK → PhonePe)",
            timestamp: new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
            request: {
              method: "POST",
              url: "PhonepeWidget.pay() — SDK internal call via sandboxed iframe",
              headers: { Authorization: "Bearer <token> (set by SDK internally)" },
              body: { note: "Card data collected securely by SDK iframes" },
            },
            response: {
              status_code: 200,
              headers: {},
              body: response,
            },
          };

          const currentLogs = [...newLogs, sdkLog];
          setLogs(currentLogs);

          const resp = response as { statusCode?: string; errorCode?: string; message?: string; redirectUrl?: string };

          if (resp.statusCode || resp.errorCode) {
            setPayStatus({ msg: `❌ Payment error: ${resp.message || resp.errorCode || "Unknown error"}`, type: "error" });
            setCardBtnDisabled(false);
            setCardBtnText(`Pay ₹${total} with Card`);
            return;
          }

          if (resp.redirectUrl) {
            window.location.href = resp.redirectUrl;
            return;
          }

          setCardBtnText("Checking status…");
          const statusR = await fetch(`/api/payment-status/${merchantOrderId}`);
          const statusData = await statusR.json();
          const allLogs = [...currentLogs, ...(statusData.logs || [])];
          setLogs(allLogs);
          localStorage.setItem("phonepe_api_logs", JSON.stringify(allLogs));

          if (statusData.state === "COMPLETED") {
            setPayStatus({ msg: `✅ Payment successful! Order ${merchantOrderId} confirmed.`, type: "success" });
            setShowCardBtn(false);
          } else if (statusData.state === "PENDING") {
            setPayStatus({ msg: `⏳ Payment pending for order ${merchantOrderId}.`, type: "info" });
            setCardBtnDisabled(false);
            setCardBtnText(`Pay ₹${total} with Card`);
          } else {
            setPayStatus({ msg: `❌ Payment failed. State: ${statusData.state}`, type: "error" });
            setCardBtnDisabled(false);
            setCardBtnText(`Pay ₹${total} with Card`);
          }
        },
      });
    } catch (err) {
      setCardBtnDisabled(false);
      setCardBtnText(`Pay ₹${total} with Card`);
      setPayStatus({ msg: `Network error: ${(err as Error).message}`, type: "error" });
    }
  }

  async function initiateOtherPayment() {
    setOtherBtnDisabled(true);
    setOtherBtnText("Initiating payment…");
    setPayStatus(null);

    try {
      const r = await fetch("/api/initiate-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json();
      const newLogs: ApiLog[] = data.logs || [];
      setLogs(newLogs);

      if (data.error) {
        setOtherBtnDisabled(false);
        setOtherBtnText(`Pay ₹${total} with PhonePe`);
        setPayStatus({ msg: data.error, type: "error" });
        return;
      }

      setOtherBtnText("Payment page loading…");
      const merchantOrderId: string = data.merchantOrderId;

      if (!window.PhonePeCheckout) {
        setPayStatus({ msg: "PhonePe Standard Checkout SDK not loaded.", type: "error" });
        setOtherBtnDisabled(false);
        setOtherBtnText(`Pay ₹${total} with PhonePe`);
        return;
      }

      window.PhonePeCheckout.transact({
        tokenUrl: data.tokenUrl,
        type: "IFRAME",
        callback: async (response: unknown) => {
          if (response === "USER_CANCEL") {
            setPayStatus({ msg: "Payment was cancelled.", type: "info" });
            setOtherBtnDisabled(false);
            setOtherBtnText(`Pay ₹${total} with PhonePe`);
            return;
          }

          setOtherBtnText("Checking status…");
          const statusR = await fetch(`/api/payment-status/${merchantOrderId}`);
          const statusData = await statusR.json();
          const allLogs = [...newLogs, ...(statusData.logs || [])];
          setLogs(allLogs);
          localStorage.setItem("phonepe_api_logs", JSON.stringify(allLogs));

          if (statusData.state === "COMPLETED") {
            setPayStatus({ msg: `✅ Payment successful! Order ${merchantOrderId} confirmed.`, type: "success" });
            setShowOtherBtn(false);
          } else if (statusData.state === "PENDING") {
            setPayStatus({ msg: `⏳ Payment pending for order ${merchantOrderId}.`, type: "info" });
            setOtherBtnDisabled(false);
            setOtherBtnText(`Pay ₹${total} with PhonePe`);
          } else {
            setPayStatus({ msg: `❌ Payment failed. State: ${statusData.state}`, type: "error" });
            setOtherBtnDisabled(false);
            setOtherBtnText(`Pay ₹${total} with PhonePe`);
          }
        },
      });
    } catch (err) {
      setOtherBtnDisabled(false);
      setOtherBtnText(`Pay ₹${total} with PhonePe`);
      setPayStatus({ msg: `Network error: ${(err as Error).message}`, type: "error" });
    }
  }

  if (items.length === 0) {
    return (
      <div>
        <h1>Checkout</h1>
        <div className="alert alert-info">Your cart is empty. <Link href="/shop">Browse Games</Link></div>
      </div>
    );
  }

  return (
    <>
      {/* PhonePe Standard Checkout SDK */}
      <Script src="https://mercury.phonepe.com/web/bundle/checkout.js" strategy="afterInteractive" />
      {/* PhonePe Card Checkout SDK */}
      <Script
        src={`${sdkDomain}/web-sdk/v1/${merchantId}/card-checkout`}
        strategy="afterInteractive"
        onLoad={handleCardSdkLoad}
      />

      <h1>Checkout</h1>
      <div className="checkout-layout">
        {/* Order Summary */}
        <div className="order-summary">
          <h2>Order Summary</h2>
          {items.map((item) => (
            <div key={item.id} className="checkout-item">
              <span>{item.title} &times; {item.quantity}</span>
              <span>₹{item.subtotal}</span>
            </div>
          ))}
          <hr style={{ borderColor: "#27272a", margin: "0.75rem 0" }} />
          <div className="checkout-item total-row">
            <span><strong>Total</strong></span>
            <span><strong>₹{total}</strong></span>
          </div>
        </div>

        {/* Payment Section */}
        <div className="payment-section">
          <h2>Choose Payment Method</h2>
          <div className="pay-tabs">
            <button
              className={`pay-tab ${activeTab === "card" ? "active" : ""}`}
              onClick={() => { setActiveTab("card"); setPayStatus(null); }}
            >
              💳 Card
            </button>
            <button
              className={`pay-tab ${activeTab === "other" ? "active" : ""}`}
              onClick={() => { setActiveTab("other"); setPayStatus(null); }}
            >
              📱 Other (UPI, NetBanking…)
            </button>
          </div>

          {/* Card Payment Panel */}
          <div className={`pay-panel ${activeTab === "card" ? "active" : ""}`}>
            {cardPanelError ? (
              <div className="alert alert-error">{cardPanelError}</div>
            ) : (
              <div className="card-form" id="cardForm">
                <div className="input-group">
                  <label>Card Number</label>
                  <div id="cardNumberDiv" className="sdk-field"></div>
                  <span id="cardNumberError" className="field-error"></span>
                </div>
                <div className="input-group">
                  <label>Cardholder Name</label>
                  <div id="cardHolderNameDiv" className="sdk-field"></div>
                  <span id="cardHolderNameError" className="field-error"></span>
                </div>
                <div className="input-row">
                  <div className="input-group">
                    <label>Expiry</label>
                    <div id="cardExpiryDiv" className="sdk-field"></div>
                    <span id="cardExpiryError" className="field-error"></span>
                  </div>
                  <div className="input-group">
                    <label>CVV</label>
                    <div id="cardCvvDiv" className="sdk-field"></div>
                    <span id="cardCvvError" className="field-error"></span>
                  </div>
                </div>
                {showCardBtn && (
                  <button
                    id="cardPayBtn"
                    className="btn btn-primary btn-full"
                    onClick={initiateCardPayment}
                    disabled={cardBtnDisabled}
                  >
                    {cardBtnText || `Pay ₹${total} with Card`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Other Payment Panel */}
          <div className={`pay-panel ${activeTab === "other" ? "active" : ""}`}>
            <div className="payment-info">
              <p>🔒 Pay securely via <strong>PhonePe</strong> — UPI, Net Banking, Wallets &amp; more.</p>
            </div>
            {showOtherBtn && (
              <button
                id="otherPayBtn"
                className="btn btn-primary btn-full"
                onClick={initiateOtherPayment}
                disabled={otherBtnDisabled}
              >
                {otherBtnText || `Pay ₹${total} with PhonePe`}
              </button>
            )}
          </div>

          {payStatus && (
            <div className={`pay-status alert alert-${payStatus.type}`} style={{ marginTop: "0.75rem" }}>
              {payStatus.msg}
            </div>
          )}
          <Link href="/cart" className="btn btn-secondary btn-full" style={{ marginTop: "0.5rem", display: "block" }}>
            Back to Cart
          </Link>
        </div>
      </div>

      {/* Inline API Logs */}
      {logs.length > 0 && (
        <div className="api-logs-section" style={{ marginTop: "2rem" }}>
          <details>
            <summary className="btn btn-secondary toggle-logs-btn" style={{ cursor: "pointer", listStyle: "none", display: "inline-block", marginBottom: "1rem" }}>
              📋 Toggle API Logs ({logs.length} call{logs.length !== 1 ? "s" : ""})
            </summary>
            <div>
              {logs.map((log, i) => (
                <div key={i} className="log-card">
                  <div className="log-header">
                    <span className="log-step">{log.step}</span>
                    <span className="log-time">{log.timestamp}</span>
                  </div>
                  <div className="log-section">
                    <h3>📤 Request</h3>
                    <div className="log-meta">
                      <span className="log-method">{log.request.method}</span>
                      <code className="log-url">{log.request.url}</code>
                    </div>
                    <details><summary>Headers</summary><pre>{JSON.stringify(log.request.headers, null, 2)}</pre></details>
                    {log.request.body !== undefined && log.request.body !== null && (
                      <details><summary>Body</summary><pre>{JSON.stringify(log.request.body, null, 2)}</pre></details>
                    )}
                  </div>
                  <div className="log-section">
                    <h3>
                      📥 Response{" "}
                      <span className={`status-badge ${log.response.status_code === 200 ? "status-ok" : "status-err"}`}>
                        {log.response.status_code}
                      </span>
                    </h3>
                    <details><summary>Headers</summary><pre>{JSON.stringify(log.response.headers, null, 2)}</pre></details>
                    <details open><summary>Body</summary><pre>{JSON.stringify(log.response.body, null, 2)}</pre></details>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </>
  );
}
