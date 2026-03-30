import type { Game } from "./types";

export const GAMES: Game[] = [
  {
    id: 1,
    title: "Demo Game — ₹1",
    price: 1,
    image: "https://upload.wikimedia.org/wikipedia/en/e/ee/God_of_War_Ragnar%C3%B6k_cover.jpg",
    description: "A ₹1 demo product to test the payment flow end-to-end.",
  },
  {
    id: 2,
    title: "Demo Game — ₹10",
    price: 10,
    image: "https://upload.wikimedia.org/wikipedia/en/4/4c/Spider-Man_2_PS5_cover_art.jpg",
    description: "A ₹10 demo product to test the payment flow end-to-end.",
  },
  {
    id: 3,
    title: "Demo Game — ₹20",
    price: 20,
    image: "https://upload.wikimedia.org/wikipedia/en/6/69/Horizon_Forbidden_West_cover_art.jpg",
    description: "A ₹20 demo product to test the payment flow end-to-end.",
  },
];

export function getGame(id: number): Game | undefined {
  return GAMES.find((g) => g.id === id);
}
