"""
Оплата тарифов через Тинькофф Кассу.
POST /init     — создать платёж, вернуть ссылку на оплату
POST /notify   — вебхук от Тинькофф (подтверждение платежа)
GET  /status   — проверить статус заказа по order_id
"""
import hashlib
import json
import os
import urllib.request
import urllib.parse
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

TINKOFF_API = "https://securepay.tinkoff.ru/v2"

PLAN_PRICES = {
    "standard": 49900,   # в копейках
    "vip":      129900,
    "premium":  299900,
}

PLAN_NAMES = {
    "standard": "Стандарт — продвижение сервера",
    "vip":      "VIP — продвижение сервера",
    "premium":  "Premium — продвижение сервера",
}


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def ensure_tables(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS orders (
            id            SERIAL PRIMARY KEY,
            order_id      VARCHAR(64) UNIQUE NOT NULL,
            server_id     INTEGER,
            plan          VARCHAR(20) NOT NULL,
            amount        INTEGER NOT NULL,
            status        VARCHAR(20) NOT NULL DEFAULT 'pending',
            payment_id    VARCHAR(64),
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            paid_at       TIMESTAMPTZ
        )
    """)


def make_token(params: dict, secret: str) -> str:
    """Подпись запроса по алгоритму Тинькофф"""
    items = sorted(
        [(k, v) for k, v in params.items() if k not in ("Token", "DATA", "Receipt", "Shops")],
        key=lambda x: x[0],
    )
    values = "".join(str(v) for _, v in items) + secret
    return hashlib.sha256(values.encode()).hexdigest()


def tinkoff_request(endpoint: str, payload: dict) -> dict:
    terminal = os.environ["TINKOFF_TERMINAL_KEY"]
    secret   = os.environ["TINKOFF_SECRET_KEY"]
    payload["TerminalKey"] = terminal
    payload["Token"] = make_token(payload, secret)

    data = json.dumps(payload).encode()
    req  = urllib.request.Request(
        f"{TINKOFF_API}/{endpoint}",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "POST")
    path   = (event.get("path") or "/").rstrip("/")

    conn = get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                ensure_tables(cur)

                # ── POST /init — инициировать платёж ──────────────────────
                if method == "POST" and path.endswith("/init"):
                    body      = json.loads(event.get("body") or "{}")
                    plan      = body.get("plan", "")
                    server_id = body.get("server_id")
                    email     = body.get("email", "")

                    if plan not in PLAN_PRICES:
                        return {"statusCode": 400, "headers": CORS,
                                "body": json.dumps({"error": "Неизвестный тариф"})}

                    amount   = PLAN_PRICES[plan]
                    order_id = f"mine_{plan}_{server_id or 0}_{os.urandom(4).hex()}"

                    # Сохраняем заказ
                    cur.execute(
                        "INSERT INTO orders (order_id, server_id, plan, amount) VALUES (%s, %s, %s, %s)",
                        (order_id, server_id, plan, amount),
                    )

                    # Запрашиваем платёж у Тинькофф
                    payload = {
                        "Amount":      amount,
                        "OrderId":     order_id,
                        "Description": PLAN_NAMES[plan],
                        "RedirectDueDate": None,
                    }
                    if email:
                        payload["DATA"] = {"Email": email}

                    result = tinkoff_request("Init", payload)

                    if result.get("Success"):
                        cur.execute(
                            "UPDATE orders SET payment_id=%s WHERE order_id=%s",
                            (str(result.get("PaymentId")), order_id),
                        )
                        return {
                            "statusCode": 200,
                            "headers": CORS,
                            "body": json.dumps({
                                "payment_url": result["PaymentURL"],
                                "order_id":    order_id,
                                "payment_id":  str(result.get("PaymentId")),
                            }),
                        }
                    else:
                        return {"statusCode": 500, "headers": CORS,
                                "body": json.dumps({"error": result.get("Message", "Ошибка Тинькофф")})}

                # ── POST /notify — вебхук от Тинькофф ─────────────────────
                if method == "POST" and path.endswith("/notify"):
                    body   = json.loads(event.get("body") or "{}")
                    status = body.get("Status", "")
                    oid    = body.get("OrderId", "")

                    if status == "CONFIRMED":
                        cur.execute(
                            "UPDATE orders SET status='paid', paid_at=NOW() WHERE order_id=%s",
                            (oid,),
                        )
                        # Обновляем план сервера
                        cur.execute("SELECT server_id, plan FROM orders WHERE order_id=%s", (oid,))
                        row = cur.fetchone()
                        if row and row[0]:
                            cur.execute(
                                "UPDATE servers SET plan=%s WHERE id=%s",
                                (row[1], row[0]),
                            )
                    elif status in ("REJECTED", "CANCELED"):
                        cur.execute(
                            "UPDATE orders SET status='failed' WHERE order_id=%s", (oid,)
                        )

                    return {"statusCode": 200, "headers": CORS, "body": "OK"}

                # ── GET /status?order_id=xxx — проверить статус ────────────
                if method == "GET" and path.endswith("/status"):
                    oid = (event.get("queryStringParameters") or {}).get("order_id", "")
                    if not oid:
                        return {"statusCode": 400, "headers": CORS,
                                "body": json.dumps({"error": "order_id обязателен"})}

                    cur.execute(
                        "SELECT status, plan, amount, paid_at FROM orders WHERE order_id=%s",
                        (oid,),
                    )
                    row = cur.fetchone()
                    if not row:
                        return {"statusCode": 404, "headers": CORS,
                                "body": json.dumps({"error": "Заказ не найден"})}

                    paid_at = row[3].isoformat() if row[3] else None
                    return {
                        "statusCode": 200,
                        "headers": CORS,
                        "body": json.dumps({
                            "status":  row[0],
                            "plan":    row[1],
                            "amount":  row[2],
                            "paid_at": paid_at,
                        }),
                    }

    finally:
        conn.close()

    return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}
