import { GAMES } from "@/lib/games";
import Image from "next/image";
import AddToCartButton from "./AddToCartButton";

interface ShopPageProps {
  searchParams: { msg?: string; type?: string };
}

export default function ShopPage({ searchParams }: ShopPageProps) {
  const { msg, type } = searchParams;

  return (
    <>
      <h1>🎮 Game Shop</h1>
      {msg && (
        <div className={`alert alert-${type || "info"}`}>{msg}</div>
      )}
      <div className="game-grid">
        {GAMES.map((game) => (
          <div key={game.id} className="game-card">
            <Image
              src={game.image}
              alt={game.title}
              width={280}
              height={340}
              style={{ width: "100%", height: "340px", objectFit: "cover" }}
            />
            <div className="game-info">
              <h3>{game.title}</h3>
              <p className="description">{game.description}</p>
              <p className="price">₹{game.price}</p>
              <AddToCartButton gameId={game.id} gameTitle={game.title} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
