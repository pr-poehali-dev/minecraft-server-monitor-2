"""
API каталога Minecraft-серверов.
GET  / — список серверов (фильтр, сортировка)
POST / — добавить сервер (мгновенно, без модерации)
POST /vote — проголосовать за сервер (1 раз в 24 ч с одного IP)
"""
import json
import os
import psycopg2

CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}

BANNER_COLORS = [
    "linear-gradient(135deg,#064e3b,#065f46,#047857)",
    "linear-gradient(135deg,#1e3a5f,#1d4ed8,#3b82f6)",
    "linear-gradient(135deg,#3b0764,#6d28d9,#8b5cf6)",
    "linear-gradient(135deg,#7f1d1d,#991b1b,#b91c1c)",
    "linear-gradient(135deg,#134e4a,#0f766e,#14b8a6)",
    "linear-gradient(135deg,#451a03,#92400e,#d97706)",
    "linear-gradient(135deg,#312e81,#4338ca,#6366f1)",
    "linear-gradient(135deg,#1c1917,#292524,#44403c)",
]


def get_conn():
    return psycopg2.connect(os.environ["DATABASE_URL"])


def ensure_tables(cur):
    cur.execute("""
        CREATE TABLE IF NOT EXISTS servers (
            id           SERIAL PRIMARY KEY,
            name         VARCHAR(100) NOT NULL,
            ip           VARCHAR(100) NOT NULL,
            version      VARCHAR(20)  NOT NULL DEFAULT '1.20.4',
            type         VARCHAR(50)  NOT NULL DEFAULT 'Выживание',
            description  TEXT         NOT NULL DEFAULT '',
            discord      VARCHAR(200) DEFAULT '',
            site         VARCHAR(200) DEFAULT '',
            plan         VARCHAR(20)  NOT NULL DEFAULT 'free',
            votes        INTEGER      NOT NULL DEFAULT 0,
            online       INTEGER      NOT NULL DEFAULT 0,
            max_players  INTEGER      NOT NULL DEFAULT 100,
            uptime       NUMERIC(4,1) NOT NULL DEFAULT 100.0,
            banner_color VARCHAR(200) DEFAULT 'linear-gradient(135deg,#064e3b,#065f46)',
            created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS server_votes (
            id        SERIAL PRIMARY KEY,
            server_id INTEGER NOT NULL REFERENCES servers(id),
            voter_ip  VARCHAR(60) NOT NULL,
            voted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    cur.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS server_votes_unique_daily
        ON server_votes (server_id, voter_ip, DATE(voted_at))
    """)


def seed_demo(cur):
    cur.execute("SELECT COUNT(*) FROM servers")
    if cur.fetchone()[0] > 0:
        return
    demo = [
        ("CraftRealm",        "play.craftrealm.ru",     "1.20.4", "Выживание", "Крупнейший выживальный сервер СНГ с уникальной экономикой, кланами и регулярными ивентами.", "premium", 4821, 847, 1500, 99.8, BANNER_COLORS[0]),
        ("PvPWorld",          "pvpworld.su",             "1.20.1", "PvP",       "Хардкорный PvP сервер с фракциями, рейдами и крутым лутом. Выживи или умри!",                "vip",     3102, 312,  800, 98.5, BANNER_COLORS[3]),
        ("SkyBlock Paradise", "skyblock.paradise-mc.ru", "1.19.4", "SkyBlock",  "Лучший SkyBlock с уникальными островами, аукционом и глобальным рейтингом игроков.",         "vip",     2890, 523, 1000, 99.2, BANNER_COLORS[1]),
        ("RPG Kingdom",       "rpgkingdom.ru",           "1.19.4", "Ролевой",   "Полноценная RPG: классы, квесты, данжи, боссы и уникальная история мира.",                   "vip",     1890, 156,  400, 98.9, BANNER_COLORS[2]),
        ("MineCity",          "minecity.pro",            "1.20.2", "Выживание", "Городской сервер с развитой экономикой, шахтами, рынком и своим государством.",               "standard",1204, 189,  500, 97.1, BANNER_COLORS[4]),
        ("HungerGames RU",    "hg.mineplay.ru",          "1.20.4", "Мини-игры", "Классические голодные игры на 24 игрока. Быстрые раунды, рейтинг, скины победителей.",        "standard", 876,  98,  300, 96.3, BANNER_COLORS[5]),
        ("AnarchyZone",       "anarchyzone.ru",          "1.20.1", "Анархия",   "Чистая анархия без правил и модераторов. Только ты, мир и другие игроки.",                   "free",      543,  67,  200, 94.0, BANNER_COLORS[7]),
        ("BuildCraft Pro",    "buildcraft.games",        "1.20.4", "Творчество","Творческий сервер с WorldEdit, плотами и конкурсами построек каждую неделю.",                 "free",      321,  44,  200, 95.5, BANNER_COLORS[6]),
    ]
    for row in demo:
        cur.execute(
            """INSERT INTO servers
               (name,ip,version,type,description,plan,votes,online,max_players,uptime,banner_color)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            row,
        )


def handler(event: dict, context) -> dict:
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS, "body": ""}

    method = event.get("httpMethod", "GET")
    path   = event.get("path", "/").rstrip("/")
    ip     = (event.get("requestContext") or {}).get("identity", {}).get("sourceIp", "0.0.0.0")

    conn = get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                ensure_tables(cur)
                seed_demo(cur)

                # ── GET / — список серверов ────────────────────────────────
                if method == "GET" and path in ("", "/"):
                    type_filter = (event.get("queryStringParameters") or {}).get("type", "")
                    sort_by     = (event.get("queryStringParameters") or {}).get("sort", "votes")
                    search      = (event.get("queryStringParameters") or {}).get("q", "")

                    order = {
                        "votes":  "CASE plan WHEN 'premium' THEN 0 WHEN 'vip' THEN 1 WHEN 'standard' THEN 2 ELSE 3 END, votes DESC",
                        "online": "CASE plan WHEN 'premium' THEN 0 WHEN 'vip' THEN 1 WHEN 'standard' THEN 2 ELSE 3 END, online DESC",
                        "new":    "CASE plan WHEN 'premium' THEN 0 WHEN 'vip' THEN 1 WHEN 'standard' THEN 2 ELSE 3 END, created_at DESC",
                    }.get(sort_by, "votes DESC")

                    where_clauses = []
                    params = []
                    if type_filter and type_filter != "Все":
                        where_clauses.append("type = %s")
                        params.append(type_filter)
                    if search:
                        where_clauses.append("(name ILIKE %s OR ip ILIKE %s)")
                        params += [f"%{search}%", f"%{search}%"]

                    where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""
                    cur.execute(
                        f"SELECT id,name,ip,version,type,description,discord,site,plan,votes,online,max_players,uptime,banner_color,created_at FROM servers {where_sql} ORDER BY {order}",
                        params,
                    )
                    rows = cur.fetchall()
                    cols = ["id","name","ip","version","type","description","discord","site","plan","votes","online","max_players","uptime","banner_color","created_at"]
                    servers = []
                    for r in rows:
                        s = dict(zip(cols, r))
                        s["uptime"] = float(s["uptime"])
                        s["created_at"] = s["created_at"].isoformat()
                        servers.append(s)
                    return {"statusCode": 200, "headers": CORS, "body": json.dumps({"servers": servers, "total": len(servers)})}

                # ── POST / — добавить сервер ───────────────────────────────
                if method == "POST" and path in ("", "/"):
                    body = json.loads(event.get("body") or "{}")
                    name    = (body.get("name") or "").strip()[:100]
                    ip_addr = (body.get("ip") or "").strip()[:100]
                    version = (body.get("version") or "1.20.4").strip()[:20]
                    stype   = (body.get("type") or "Выживание").strip()[:50]
                    desc    = (body.get("description") or "").strip()[:2000]
                    discord = (body.get("discord") or "").strip()[:200]
                    site    = (body.get("site") or "").strip()[:200]

                    if not name or not ip_addr:
                        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "name и ip обязательны"})}

                    import random
                    banner = random.choice(BANNER_COLORS)
                    cur.execute(
                        """INSERT INTO servers (name,ip,version,type,description,discord,site,plan,banner_color)
                           VALUES (%s,%s,%s,%s,%s,%s,%s,'free',%s) RETURNING id""",
                        (name, ip_addr, version, stype, desc, discord, site, banner),
                    )
                    new_id = cur.fetchone()[0]
                    return {"statusCode": 201, "headers": CORS, "body": json.dumps({"id": new_id, "message": "Сервер добавлен"})}

                # ── POST /vote — голосовать ────────────────────────────────
                if method == "POST" and path.endswith("/vote"):
                    body      = json.loads(event.get("body") or "{}")
                    server_id = int(body.get("server_id", 0))
                    if not server_id:
                        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "server_id обязателен"})}

                    try:
                        cur.execute(
                            "INSERT INTO server_votes (server_id, voter_ip) VALUES (%s, %s)",
                            (server_id, ip),
                        )
                        cur.execute("UPDATE servers SET votes = votes + 1 WHERE id = %s RETURNING votes", (server_id,))
                        new_votes = cur.fetchone()[0]
                        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"votes": new_votes, "voted": True})}
                    except psycopg2.errors.UniqueViolation:
                        conn.rollback()
                        cur.execute("SELECT votes FROM servers WHERE id = %s", (server_id,))
                        row = cur.fetchone()
                        votes = row[0] if row else 0
                        return {"statusCode": 200, "headers": CORS, "body": json.dumps({"votes": votes, "voted": False, "message": "Уже голосовали сегодня"})}

    finally:
        conn.close()

    return {"statusCode": 404, "headers": CORS, "body": json.dumps({"error": "Not found"})}
