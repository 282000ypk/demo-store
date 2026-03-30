export interface ApiLog {
  step: string;
  timestamp: string;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: unknown;
  };
  response: {
    status_code: number;
    headers: Record<string, string>;
    body: unknown;
  };
}

export interface Game {
  id: number;
  title: string;
  price: number;
  image: string;
  description: string;
}

export interface CartItem extends Game {
  quantity: number;
  subtotal: number;
}

export type Cart = Record<string, number>; // gameId -> quantity
