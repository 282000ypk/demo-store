'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";

interface CartActionsProps {
  gameId: number;
  quantity: number;
  action?: "update" | "remove";
}

export default function CartActions({ gameId, quantity, action = "update" }: CartActionsProps) {
  const router = useRouter();
  const [qty, setQty] = useState(quantity);
  const [loading, setLoading] = useState(false);

  async function handleUpdate(newQty: number) {
    setLoading(true);
    try {
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, action: "update", quantity: newQty }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    setLoading(true);
    try {
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, action: "remove" }),
      });
      router.push("/cart?msg=Item+removed+from+cart&type=info");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (action === "remove") {
    return (
      <button className="btn btn-danger btn-small" onClick={handleRemove} disabled={loading}>
        {loading ? "…" : "Remove"}
      </button>
    );
  }

  return (
    <div className="qty-form">
      <input
        type="number"
        min={1}
        value={qty}
        onChange={(e) => setQty(parseInt(e.target.value) || 1)}
        style={{ width: "55px", padding: "0.3rem", border: "1px solid #3f3f46", borderRadius: "6px", background: "#27272a", color: "#e4e4e7", textAlign: "center" }}
      />
      <button className="btn btn-secondary btn-small" onClick={() => handleUpdate(qty)} disabled={loading}>
        {loading ? "…" : "Update"}
      </button>
    </div>
  );
}
