'use client';

import { useRouter } from "next/navigation";
import { useState } from "react";

interface AddToCartButtonProps {
  gameId: number;
  gameTitle: string;
}

export default function AddToCartButton({ gameId, gameTitle }: AddToCartButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAdd() {
    setLoading(true);
    try {
      await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, action: "add" }),
      });
      router.push(`/shop?msg=${encodeURIComponent(`Added ${gameTitle} to cart!`)}&type=success`);
      router.refresh();
    } catch {
      router.push("/shop?msg=Failed+to+add+to+cart&type=error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn btn-primary btn-full" onClick={handleAdd} disabled={loading}>
      {loading ? "Adding…" : "Add to Cart"}
    </button>
  );
}
