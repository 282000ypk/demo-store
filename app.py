import json
import os
import time
import uuid
from datetime import datetime

import requests as http_requests
from flask import Flask, render_template, session, redirect, url_for, request, flash, jsonify

# Load .env file when running locally (no-op if python-dotenv is not installed)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "change-this-to-a-real-secret-key")

# ── PhonePe PG Configuration (set these in Netlify environment variables) ─
PHONEPE_CLIENT_ID = os.environ.get("PHONEPE_CLIENT_ID", "")
PHONEPE_CLIENT_SECRET = os.environ.get("PHONEPE_CLIENT_SECRET", "")
PHONEPE_CLIENT_VERSION = os.environ.get("PHONEPE_CLIENT_VERSION", "1")

# Switch between "sandbox" and "production"
PHONEPE_ENV = os.environ.get("PHONEPE_ENV", "sandbox")
PHONEPE_MERCHANT_ID = os.environ.get("PHONEPE_MERCHANT_ID", "")

_ENV_CONFIG = {
    "sandbox": {
        "base_url": "https://api-preprod.phonepe.com/apis/pg-sandbox",
        "token_url": "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token",
        "sdk_domain": "https://mercury-stg.phonepe.com",
    },
    "production": {
        "base_url": "https://api.phonepe.com/apis/pg",
        "token_url": "https://api.phonepe.com/apis/identity-manager/v1/oauth/token",
        "sdk_domain": "https://mercury-t2.phonepe.com",
    },
}

# Token cache
_token_cache = {"access_token": None, "expires_at": 0}


# ── API Logger ──────────────────────────────────────────────────────────
def _log_api_call(step, method, url, req_headers, req_body, resp_status, resp_headers, resp_body):
    """Append a full API call trace to the session and print to terminal."""
    from urllib.parse import urlparse
    parsed = urlparse(url)
    host = parsed.hostname

    log_entry = {
        "step": step,
        "timestamp": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
        "request": {
            "method": method,
            "url": url,
            "headers": {k: v for k, v in req_headers.items()},
            "body": req_body,
        },
        "response": {
            "status_code": resp_status,
            "headers": {k: v for k, v in resp_headers.items()},
            "body": resp_body,
        },
    }
    logs = session.get("api_logs", [])
    logs.append(log_entry)
    session["api_logs"] = logs

    # ── Terminal logging ────────────────────────────────────────────
    separator = "=" * 70
    print(f"\n{separator}")
    print(f"  📡 {step}")
    print(f"{separator}")
    print(f"  Host:   {host}")
    print(f"  Method: {method}")
    print(f"  URL:    {url}")
    print(f"\n  ── Request Headers ──")
    for k, v in req_headers.items():
        print(f"    {k}: {v}")
    if req_body:
        print(f"\n  ── Request Body ──")
        print(f"    {json.dumps(req_body, indent=4, default=str)}")
    print(f"\n  ── Response [{resp_status}] ──")
    print(f"  ── Response Headers ──")
    for k, v in (resp_headers if isinstance(resp_headers, dict) else {}).items():
        print(f"    {k}: {v}")
    print(f"\n  ── Response Body ──")
    print(f"    {json.dumps(resp_body, indent=4, default=str)}")
    print(separator)


# ── PhonePe Auth ────────────────────────────────────────────────────────
def _get_access_token():
    """Fetch or return cached OAuth token. Logs the API call."""
    if _token_cache["access_token"] and time.time() < _token_cache["expires_at"] - 60:
        return _token_cache["access_token"]

    url = _ENV_CONFIG[PHONEPE_ENV]["token_url"]
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "client_id": PHONEPE_CLIENT_ID,
        "client_version": PHONEPE_CLIENT_VERSION,
        "client_secret": PHONEPE_CLIENT_SECRET,
        "grant_type": "client_credentials",
    }

    resp = http_requests.post(url, headers=headers, data=data)

    try:
        resp_body = resp.json()
    except Exception:
        resp_body = resp.text

    _log_api_call(
        step="1. OAuth Token",
        method="POST",
        url=url,
        req_headers=headers,
        req_body=data,
        resp_status=resp.status_code,
        resp_headers=dict(resp.headers),
        resp_body=resp_body,
    )

    if resp.status_code == 200:
        body = resp_body
        _token_cache["access_token"] = body["access_token"]
        _token_cache["expires_at"] = body.get("expires_at", time.time() + 600)
        return body["access_token"]

    return None


# ── PhonePe Payment Initiation ──────────────────────────────────────────
def _initiate_payment(amount_paisa, merchant_order_id, redirect_url):
    """Call PhonePe Standard Checkout pay API. Logs the API call."""
    token = _get_access_token()
    if not token:
        return None

    url = f"{_ENV_CONFIG[PHONEPE_ENV]['base_url']}/checkout/v2/pay"
    headers = {
        "Authorization": f"O-Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "merchantOrderId": merchant_order_id,
        "amount": amount_paisa,
        "paymentFlow": {
            "type": "PG_CHECKOUT",
            "merchantUrls": {
                "redirectUrl": redirect_url,
            },
        },
    }

    resp = http_requests.post(url, headers=headers, json=payload)

    try:
        resp_body = resp.json()
    except Exception:
        resp_body = resp.text

    _log_api_call(
        step="2. Initiate Payment",
        method="POST",
        url=url,
        req_headers=headers,
        req_body=payload,
        resp_status=resp.status_code,
        resp_headers=dict(resp.headers),
        resp_body=resp_body,
    )

    if resp.status_code == 200:
        return resp_body
    return None


# ── PhonePe Status Check ───────────────────────────────────────────────
def _check_payment_status(merchant_order_id):
    """Check order status. Logs the API call."""
    token = _get_access_token()
    if not token:
        return None

    url = f"{_ENV_CONFIG[PHONEPE_ENV]['base_url']}/checkout/v2/order/{merchant_order_id}/status?details=true&errorContext=true"
    headers = {
        "Authorization": f"O-Bearer {token}",
        "Content-Type": "application/json",
    }

    resp = http_requests.get(url, headers=headers)

    try:
        resp_body = resp.json()
    except Exception:
        resp_body = resp.text

    _log_api_call(
        step="3. Check Payment Status",
        method="GET",
        url=url,
        req_headers=headers,
        req_body=None,
        resp_status=resp.status_code,
        resp_headers=dict(resp.headers),
        resp_body=resp_body,
    )

    if resp.status_code == 200:
        return resp_body
    return None


# ── PhonePe Create Order Token (for Card Checkout SDK) ─────────────────
def _create_order_token(amount_paisa, merchant_order_id):
    """Call PhonePe SDK order API to get a transactionToken. Logs the API call."""
    token = _get_access_token()
    if not token:
        return None

    url = f"{_ENV_CONFIG[PHONEPE_ENV]['base_url']}/payments/v2/sdk/order"
    headers = {
        "Authorization": f"O-Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "merchantOrderId": merchant_order_id,
        "amount": amount_paisa,
        "paymentFlow": {
            "type": "PG",
        },
    }

    resp = http_requests.post(url, headers=headers, json=payload)

    try:
        resp_body = resp.json()
    except Exception:
        resp_body = resp.text

    _log_api_call(
        step="2. Create Order Token (Card Checkout)",
        method="POST",
        url=url,
        req_headers=headers,
        req_body=payload,
        resp_status=resp.status_code,
        resp_headers=dict(resp.headers),
        resp_body=resp_body,
    )

    if resp.status_code == 200:
        return resp_body
    return None

# ── In-memory game catalog ─────────────────────────────────────────────
GAMES = [
    {
        "id": 1,
        "title": "Demo Game — ₹1",
        "price": 1,
        "image": "https://upload.wikimedia.org/wikipedia/en/e/ee/God_of_War_Ragnar%C3%B6k_cover.jpg",
        "description": "A ₹1 demo product to test the payment flow end-to-end.",
    },
    {
        "id": 2,
        "title": "Demo Game — ₹10",
        "price": 10,
        "image": "https://upload.wikimedia.org/wikipedia/en/4/4c/Spider-Man_2_PS5_cover_art.jpg",
        "description": "A ₹10 demo product to test the payment flow end-to-end.",
    },
    {
        "id": 3,
        "title": "Demo Game — ₹20",
        "price": 20,
        "image": "https://upload.wikimedia.org/wikipedia/en/6/69/Horizon_Forbidden_West_cover_art.jpg",
        "description": "A ₹20 demo product to test the payment flow end-to-end.",
    },
]


def _get_game(game_id):
    return next((g for g in GAMES if g["id"] == game_id), None)


def _cart_items():
    """Return list of cart dicts with full game info + quantity."""
    cart = session.get("cart", {})
    items = []
    for gid_str, qty in cart.items():
        game = _get_game(int(gid_str))
        if game:
            items.append({**game, "quantity": qty, "subtotal": game["price"] * qty})
    return items


# ── Routes ──────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return redirect(url_for("shop"))


@app.route("/shop")
def shop():
    cart = session.get("cart", {})
    cart_count = sum(cart.values())
    return render_template("shop.html", games=GAMES, cart_count=cart_count)


@app.route("/cart/add/<int:game_id>", methods=["POST"])
def add_to_cart(game_id):
    game = _get_game(game_id)
    if not game:
        flash("Game not found.", "error")
        return redirect(url_for("shop"))

    cart = session.get("cart", {})
    key = str(game_id)
    cart[key] = cart.get(key, 0) + 1
    session["cart"] = cart
    flash(f"Added {game['title']} to cart!", "success")
    return redirect(url_for("shop"))


@app.route("/cart")
def cart():
    items = _cart_items()
    total = sum(i["subtotal"] for i in items)
    cart_count = sum(i["quantity"] for i in items)
    return render_template("cart.html", items=items, total=total, cart_count=cart_count)


@app.route("/cart/update/<int:game_id>", methods=["POST"])
def update_cart(game_id):
    qty = request.form.get("quantity", 1, type=int)
    cart = session.get("cart", {})
    key = str(game_id)

    if qty <= 0:
        cart.pop(key, None)
    else:
        cart[key] = qty

    session["cart"] = cart
    return redirect(url_for("cart"))


@app.route("/cart/remove/<int:game_id>", methods=["POST"])
def remove_from_cart(game_id):
    cart = session.get("cart", {})
    cart.pop(str(game_id), None)
    session["cart"] = cart
    flash("Item removed from cart.", "info")
    return redirect(url_for("cart"))


@app.route("/checkout", methods=["GET"])
def checkout():
    items = _cart_items()
    if not items:
        flash("Your cart is empty.", "error")
        return redirect(url_for("shop"))

    total = sum(i["subtotal"] for i in items)
    cart_count = sum(i["quantity"] for i in items)
    logs = session.get("api_logs", [])
    sdk_domain = _ENV_CONFIG[PHONEPE_ENV]["sdk_domain"]
    return render_template(
        "checkout.html",
        items=items, total=total, cart_count=cart_count, logs=logs,
        merchant_id=PHONEPE_MERCHANT_ID, sdk_domain=sdk_domain,
    )


@app.route("/api/initiate-payment", methods=["POST"])
def initiate_payment_api():
    """JSON endpoint: initiates PhonePe payment and returns tokenUrl + logs."""
    items = _cart_items()
    if not items:
        return jsonify({"error": "Cart is empty"}), 400

    total = sum(i["subtotal"] for i in items)

    # Clear previous API logs for a fresh trace
    session["api_logs"] = []

    amount_paisa = total * 100
    merchant_order_id = f"PS5-{uuid.uuid4().hex[:12].upper()}"
    redirect_callback = url_for("payment_callback", merchant_order_id=merchant_order_id, _external=True)

    session["current_order_id"] = merchant_order_id

    result = _initiate_payment(amount_paisa, merchant_order_id, redirect_callback)
    logs = session.get("api_logs", [])

    if result and "redirectUrl" in result:
        return jsonify({
            "tokenUrl": result["redirectUrl"],
            "merchantOrderId": merchant_order_id,
            "logs": logs,
        })
    else:
        return jsonify({"error": "Payment initiation failed", "logs": logs}), 500


@app.route("/api/create-order-token", methods=["POST"])
def create_order_token_api():
    """JSON endpoint: creates order token for Card Checkout SDK."""
    items = _cart_items()
    if not items:
        return jsonify({"error": "Cart is empty"}), 400

    total = sum(i["subtotal"] for i in items)

    # Clear previous API logs for a fresh trace
    session["api_logs"] = []

    amount_paisa = total * 100
    merchant_order_id = f"PS5-{uuid.uuid4().hex[:12].upper()}"
    session["current_order_id"] = merchant_order_id

    result = _create_order_token(amount_paisa, merchant_order_id)
    logs = session.get("api_logs", [])

    if result and "token" in result:
        return jsonify({
            "transactionToken": result["token"],
            "merchantOrderId": merchant_order_id,
            "logs": logs,
        })
    else:
        return jsonify({"error": "Order token creation failed", "logs": logs}), 500


@app.route("/api/payment-status/<merchant_order_id>")
def payment_status_api(merchant_order_id):
    """JSON endpoint: checks payment status and returns state + logs."""
    status_result = _check_payment_status(merchant_order_id)
    logs = session.get("api_logs", [])
    state = status_result.get("state", "UNKNOWN") if status_result else "UNKNOWN"

    if state == "COMPLETED":
        session.pop("cart", None)

    return jsonify({"state": state, "logs": logs})


@app.route("/payment/callback")
def payment_callback():
    """PhonePe redirects user here after payment (fallback for redirect mode)."""
    merchant_order_id = request.args.get("merchant_order_id") or session.get("current_order_id")

    if not merchant_order_id:
        flash("No order found.", "error")
        return redirect(url_for("shop"))

    status_result = _check_payment_status(merchant_order_id)
    state = status_result.get("state", "UNKNOWN") if status_result else "UNKNOWN"

    if state == "COMPLETED":
        session.pop("cart", None)
        flash(f"Payment successful! Order {merchant_order_id} confirmed.", "success")
    elif state == "PENDING":
        flash(f"Payment is still pending for order {merchant_order_id}.", "info")
    else:
        flash(f"Payment failed for order {merchant_order_id}. State: {state}", "error")

    return redirect(url_for("order_result"))


@app.route("/order-result")
def order_result():
    """Show order result with API logs."""
    logs = session.get("api_logs", [])
    cart = session.get("cart", {})
    cart_count = sum(cart.values())
    return render_template("order_result.html", logs=logs, cart_count=cart_count)


@app.route("/api-logs")
def api_logs():
    """Display all PhonePe API request/response logs."""
    logs = session.get("api_logs", [])
    cart = session.get("cart", {})
    cart_count = sum(cart.values())
    return render_template("api_logs.html", logs=logs, cart_count=cart_count)


if __name__ == "__main__":
    app.run(debug=True)
