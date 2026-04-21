import { useState, useEffect, useCallback } from "react";
import Icon from "@/components/ui/icon";

// ─── Конфиг API ───────────────────────────────────────────────────────────────

const API = "https://functions.poehali.dev/09b533d2-c1db-4000-80a6-6d371d4a4df4";

// ─── Типы ─────────────────────────────────────────────────────────────────────

type ServerPlan = "free" | "standard" | "vip" | "premium";

interface Server {
  id: number;
  name: string;
  ip: string;
  version: string;
  type: string;
  description: string;
  discord: string;
  site: string;
  plan: ServerPlan;
  votes: number;
  online: number;
  max_players: number;
  uptime: number;
  banner_color: string;
  created_at: string;
}

// ─── Константы ────────────────────────────────────────────────────────────────

const NAV = [
  { id: "home",    label: "Каталог" },
  { id: "add",     label: "Добавить сервер" },
  { id: "pricing", label: "Продвижение" },
];

const TICKER = [
  "⛏️ CraftRealm — 847 онлайн",
  "🗳️ PvPWorld получил 1200 голосов",
  "🆕 SkyBlock Paradise только что добавлен",
  "👑 TopMine — #1 в рейтинге",
  "🔥 HungerGames — 312 онлайн",
  "⚡ Новый сервер добавлен только что",
  "🏆 Голосуй за любимый сервер раз в 24 часа",
];

const TYPES = ["Все", "Выживание", "PvP", "SkyBlock", "Анархия", "Мини-игры", "Ролевой", "Творчество", "Хардкор"];

const PLANS = [
  {
    key: "free" as ServerPlan,
    name: "Бесплатно", price: "0",
    color: "#64748b", highlight: false,
    features: ["Размещение в каталоге", "До 200 игроков", "Стандартная позиция", "Базовая статистика"],
    cta: "Разместить бесплатно",
  },
  {
    key: "standard" as ServerPlan,
    name: "Стандарт", price: "499",
    color: "#22c55e", highlight: false,
    features: ["Всё из Бесплатного", "Приоритет в поиске", "Баннер сервера", "До 1000 игроков", "Расширенная статистика"],
    cta: "Выбрать план",
  },
  {
    key: "vip" as ServerPlan,
    name: "VIP", price: "1 299",
    color: "#f59e0b", highlight: true,
    features: ["Всё из Стандарта", "Значок VIP на карточке", "Топ-3 в категории", "Выделение в списке", "Бонусные голоса ×2", "Уведомление подписчикам"],
    cta: "Стать VIP",
  },
  {
    key: "premium" as ServerPlan,
    name: "Premium", price: "2 999",
    color: "#e879f9", highlight: false,
    features: ["Всё из VIP", "Место #1 на главной", "Баннер-реклама на сайте", "Неограниченные игроки", "Персональный менеджер", "Брендированная страница"],
    cta: "Получить Premium",
  },
];

const PLAN_BADGE: Record<ServerPlan, { label: string; cls: string }> = {
  free:     { label: "",            cls: "" },
  standard: { label: "⭐ Стандарт", cls: "text-green-400 bg-green-500/12 border border-green-500/25" },
  vip:      { label: "👑 VIP",      cls: "text-amber-400 bg-amber-500/12 border border-amber-500/30" },
  premium:  { label: "💎 Premium",  cls: "text-fuchsia-400 bg-fuchsia-500/12 border border-fuchsia-500/30" },
};

// ─── Вспомогательные компоненты ───────────────────────────────────────────────

function OnlineBadge({ online, max }: { online: number; max: number }) {
  const pct = max > 0 ? online / max : 0;
  const color = pct > 0.8 ? "#ef4444" : pct > 0.5 ? "#f59e0b" : "#22c55e";
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full pulse-dot flex-shrink-0"
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
      <span className="text-xs font-mono text-white/70 whitespace-nowrap">
        <span className="text-white font-semibold">{online}</span>/{max}
      </span>
    </div>
  );
}

function VoteBar({ votes }: { votes: number }) {
  const pct = Math.min(100, (votes / 5000) * 100);
  return (
    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
      <div className="h-full rounded-full bg-gradient-to-r from-amber-500/70 to-amber-400"
        style={{ width: `${pct}%`, transition: "width 0.8s ease" }} />
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 rounded-full border-2 border-green-500/30 border-t-green-400 animate-spin" />
    </div>
  );
}

// ─── Карточка сервера ─────────────────────────────────────────────────────────

function ServerCard({ server, rank, onVoted }: { server: Server; rank: number; onVoted: (id: number, votes: number) => void }) {
  const [voting, setVoting] = useState(false);
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  const badge = PLAN_BADGE[server.plan];
  const isPremium = server.plan === "premium";
  const isVip     = server.plan === "vip";

  const handleVote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (voting || alreadyVoted) return;
    setVoting(true);
    try {
      const res = await fetch(`${API}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ server_id: server.id }),
      });
      const data = await res.json();
      if (data.voted === false) setAlreadyVoted(true);
      onVoted(server.id, data.votes);
    } finally {
      setVoting(false);
    }
  };

  const isNew = Date.now() - new Date(server.created_at).getTime() < 48 * 3600 * 1000;

  return (
    <div className={`group relative rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.012] hover:-translate-y-0.5 cursor-pointer ${
      isPremium ? "neon-border shadow-[0_0_30px_rgba(34,197,94,0.12)]"
      : isVip   ? "gold-border shadow-[0_0_20px_rgba(245,158,11,0.08)]"
      : "glass-card hover:border-white/14"
    }`}>
      {/* Баннер */}
      <div className="h-20 relative overflow-hidden" style={{ background: server.banner_color }}>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
        <div className={`absolute top-3 left-3 w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-display ${
          rank === 1 ? "bg-amber-500 text-black"
          : rank === 2 ? "bg-slate-400 text-black"
          : rank === 3 ? "bg-amber-700 text-white"
          : "bg-black/40 text-white/70 border border-white/15"
        }`}>{rank}</div>
        {isNew && (
          <div className="absolute top-3 right-3 px-2 py-0.5 bg-green-500 text-black text-[10px] font-bold rounded-full uppercase tracking-wide">
            Новый
          </div>
        )}
        {badge.label && (
          <div className={`absolute bottom-2 right-3 px-2 py-0.5 text-[10px] font-semibold rounded-full ${badge.cls}`}>
            {badge.label}
          </div>
        )}
      </div>

      {/* Тело */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <h3 className="font-display text-base font-bold text-white uppercase tracking-wide truncate group-hover:text-green-300 transition-colors">
              {server.name}
            </h3>
            <div className="text-[11px] text-white/35 font-mono truncate">{server.ip}</div>
          </div>
          <OnlineBadge online={server.online} max={server.max_players} />
        </div>

        <p className="text-xs text-white/50 leading-relaxed mb-3 line-clamp-2">{server.description}</p>

        <div className="flex flex-wrap gap-1 mb-3">
          <span className="px-2 py-0.5 bg-white/5 border border-white/8 rounded-md text-[10px] text-white/40 font-mono">
            {server.version}
          </span>
          <span className="px-2 py-0.5 bg-green-500/8 border border-green-500/18 rounded-md text-[10px] text-green-400/70">
            {server.type}
          </span>
        </div>

        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-white/30 font-mono">Голоса</span>
            <span className="text-[10px] text-amber-400 font-semibold">{server.votes.toLocaleString("ru")}</span>
          </div>
          <VoteBar votes={server.votes} />
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleVote}
            disabled={voting || alreadyVoted}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1.5 ${
              alreadyVoted
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-default"
                : "bg-white/6 text-white/70 border border-white/10 hover:bg-amber-500/12 hover:text-amber-400 hover:border-amber-500/25"
            }`}
          >
            {voting ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" /> : <Icon name="ThumbsUp" size={12} />}
            {alreadyVoted ? "Голос засчитан" : "Голосовать"}
          </button>
          <button className="flex-1 py-2 rounded-xl text-xs font-semibold bg-green-500/12 text-green-400 border border-green-500/25 hover:bg-green-500/20 transition-all duration-200 flex items-center justify-center gap-1.5">
            <Icon name="ExternalLink" size={12} />
            Подробнее
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Навбар ────────────────────────────────────────────────────────────────────

function Navbar({ page, setPage }: { page: string; setPage: (p: string) => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", h);
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "py-2 bg-[#080c10]/95 backdrop-blur-xl border-b border-white/5" : "py-4"}`}>
      <div className="max-w-7xl mx-auto px-5 flex items-center justify-between">
        <button onClick={() => setPage("home")} className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-green-500/18 neon-border flex items-center justify-center text-base">⛏️</div>
          <span className="font-display text-lg font-bold text-white tracking-wider">
            Mine<span className="neon-text">ED</span>
          </span>
        </button>
        <div className="hidden md:flex items-center gap-1">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                page === n.id ? "text-green-400 bg-green-500/10 neon-border" : "text-white/55 hover:text-white/85 hover:bg-white/5"
              }`}>{n.label}</button>
          ))}
        </div>
        <div className="hidden md:flex items-center gap-3">
          <button onClick={() => setPage("add")}
            className="px-5 py-2 bg-green-500 text-black font-bold text-sm rounded-xl hover:bg-green-400 neon-glow transition-all hover:scale-105">
            + Добавить сервер
          </button>
        </div>
        <button onClick={() => setOpen(!open)} className="md:hidden text-white/60 hover:text-white">
          <Icon name={open ? "X" : "Menu"} size={22} />
        </button>
      </div>
      {open && (
        <div className="md:hidden mt-2 mx-4 rounded-xl bg-[#0d1117] border border-white/8 p-3 space-y-1">
          {NAV.map(n => (
            <button key={n.id} onClick={() => { setPage(n.id); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 rounded-lg text-sm text-white/75 hover:bg-white/5">{n.label}</button>
          ))}
          <div className="pt-2 border-t border-white/5">
            <button onClick={() => { setPage("add"); setOpen(false); }}
              className="w-full py-2.5 bg-green-500 text-black font-bold text-sm rounded-xl">
              + Добавить сервер
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

// ─── Страница: Каталог ────────────────────────────────────────────────────────

function HomePage({ setPage }: { setPage: (p: string) => void }) {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [activeType, setActiveType] = useState("Все");
  const [search, setSearch]   = useState("");
  const [sort, setSort]       = useState<"votes" | "online" | "new">("votes");

  const fetchServers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ sort });
      if (activeType !== "Все") params.set("type", activeType);
      if (search) params.set("q", search);
      const res = await fetch(`${API}/?${params}`);
      const data = await res.json();
      setServers(data.servers || []);
    } catch {
      setError("Не удалось загрузить серверы. Попробуй позже.");
    } finally {
      setLoading(false);
    }
  }, [activeType, sort, search]);

  useEffect(() => { fetchServers(); }, [fetchServers]);

  const handleVoted = (id: number, votes: number) => {
    setServers(prev => prev.map(s => s.id === id ? { ...s, votes } : s));
  };

  const totalOnline = servers.reduce((a, s) => a + s.online, 0);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative pt-28 pb-14 px-5 grid-bg overflow-hidden">
        <div className="absolute top-20 left-1/3 w-80 h-80 bg-green-500/7 rounded-full blur-3xl pointer-events-none" />

        {/* Тикер */}
        <div className="absolute top-[72px] left-0 right-0 overflow-hidden py-1.5 border-y border-green-500/10 bg-green-500/3">
          <div className="flex animate-ticker whitespace-nowrap">
            {[...TICKER, ...TICKER].map((t, i) => (
              <span key={i} className="text-[11px] text-green-400/60 mx-8 font-mono">{t}</span>
            ))}
          </div>
        </div>

        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 neon-border text-green-400 text-xs font-semibold mb-6 slide-up">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 pulse-dot" />
            {loading ? "Загрузка..." : `${totalOnline.toLocaleString("ru")} игроков онлайн прямо сейчас`}
          </div>

          <h1 className="font-display text-5xl md:text-6xl font-bold text-white uppercase tracking-wide mb-4 slide-up d1">
            Найди свой<br /><span className="neon-text">Minecraft сервер</span>
          </h1>
          <p className="text-white/45 text-base max-w-xl mx-auto mb-8 slide-up d2">
            Каталог лучших серверов СНГ. Голосуй, продвигай, играй.
          </p>

          <div className="relative max-w-lg mx-auto slide-up d3">
            <Icon name="Search" size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              placeholder="Название или IP сервера..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3.5 bg-white/6 border border-white/10 rounded-xl text-white placeholder:text-white/25 text-sm focus:outline-none focus:border-green-500/45 transition-colors"
            />
          </div>

          {!loading && (
            <div className="flex justify-center gap-8 mt-7 slide-up d4">
              {[
                { v: servers.length, label: "серверов" },
                { v: totalOnline.toLocaleString("ru"), label: "онлайн" },
                { v: servers.reduce((a, s) => a + s.votes, 0).toLocaleString("ru"), label: "голосов" },
              ].map((s, i) => (
                <div key={i} className="text-center">
                  <div className="font-display text-2xl font-bold neon-text">{s.v}</div>
                  <div className="text-xs text-white/35">{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Фильтры */}
      <section className="px-5 py-4 border-b border-white/5 sticky top-[60px] z-30 bg-[#080c10]/90 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {TYPES.map(t => (
              <button key={t} onClick={() => setActiveType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                  activeType === t
                    ? "bg-green-500/18 text-green-400 neon-border"
                    : "bg-white/4 text-white/45 border border-white/7 hover:text-white/70 hover:bg-white/7"
                }`}>{t}</button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-white/30">Сорт:</span>
            {(["votes", "online", "new"] as const).map(s => (
              <button key={s} onClick={() => setSort(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  sort === s ? "bg-green-500/18 text-green-400 neon-border" : "text-white/40 hover:text-white/60 hover:bg-white/5"
                }`}>
                {s === "votes" ? "Голоса" : s === "online" ? "Онлайн" : "Новые"}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Сетка */}
      <section className="px-5 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Рекламный баннер */}
          <div className="mb-6 rounded-2xl neon-border p-5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-green-500/4 relative overflow-hidden">
            <div className="absolute inset-0 grid-bg opacity-50" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 neon-border flex items-center justify-center text-lg">📣</div>
              <div>
                <div className="text-xs text-green-400/60 font-mono uppercase tracking-widest">Рекламное место</div>
                <div className="font-display font-bold text-white text-lg uppercase">Здесь может быть ваш сервер</div>
                <div className="text-xs text-white/40">Premium размещение — первое место на главной</div>
              </div>
            </div>
            <button onClick={() => setPage("pricing")}
              className="relative z-10 flex-shrink-0 px-6 py-2.5 bg-green-500 text-black font-bold text-sm rounded-xl hover:bg-green-400 neon-glow transition-all hover:scale-105">
              Разместить рекламу
            </button>
          </div>

          {loading ? <Spinner /> : error ? (
            <div className="text-center py-20">
              <Icon name="AlertCircle" size={36} className="mx-auto mb-3 text-red-400/60" />
              <p className="text-white/40 text-sm">{error}</p>
              <button onClick={fetchServers} className="mt-4 px-5 py-2 bg-white/8 border border-white/10 rounded-xl text-sm text-white/70 hover:bg-white/12">
                Повторить
              </button>
            </div>
          ) : servers.length === 0 ? (
            <div className="text-center py-20 text-white/30">
              <Icon name="SearchX" size={40} className="mx-auto mb-3 opacity-40" />
              <p>Серверы не найдены</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {servers.map((server, i) => (
                <ServerCard key={server.id} server={server} rank={i + 1} onVoted={handleVoted} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ─── Страница: Добавить сервер ────────────────────────────────────────────────

function AddServerPage({ setPage }: { setPage: (p: string) => void }) {
  const [form, setForm] = useState({ name: "", ip: "", version: "1.20.4", type: "Выживание", description: "", discord: "", site: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState("");

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.ip.trim()) {
      setError("Название и IP-адрес обязательны");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.status === 201) {
        setSuccess(true);
      } else {
        const d = await res.json();
        setError(d.error || "Ошибка при добавлении");
      }
    } catch {
      setError("Сеть недоступна. Попробуй позже.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen pt-28 pb-16 px-5 flex items-center justify-center">
        <div className="max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 neon-border flex items-center justify-center text-3xl mx-auto mb-6">✅</div>
          <h2 className="font-display text-3xl font-bold text-white uppercase mb-3">Сервер добавлен!</h2>
          <p className="text-white/45 text-sm mb-8">Твой сервер уже в каталоге. Хочешь больше игроков — выбери план продвижения.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setPage("home")} className="px-6 py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 neon-glow transition-all">
              В каталог
            </button>
            <button onClick={() => setPage("pricing")} className="px-6 py-3 bg-white/8 border border-white/12 text-white font-semibold rounded-xl hover:bg-white/12 transition-all">
              Продвижение
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-28 pb-16 px-5">
      <div className="max-w-xl mx-auto">
        <div className="text-center mb-10">
          <div className="text-green-400 text-xs font-mono uppercase tracking-widest mb-2">// Бесплатно и мгновенно</div>
          <h2 className="font-display text-4xl font-bold text-white uppercase tracking-wide mb-2">Добавить сервер</h2>
          <p className="text-white/40 text-sm">Заполни форму — сервер сразу появится в каталоге без модерации.</p>
        </div>

        <div className="glass-card neon-border rounded-2xl p-7 space-y-4">
          {[
            { key: "name",        label: "Название сервера *",    placeholder: "Мой крутой сервер",    type: "text" },
            { key: "ip",          label: "IP-адрес *",             placeholder: "play.myserver.ru",     type: "text" },
            { key: "version",     label: "Версия Minecraft",       placeholder: "1.20.4",               type: "text" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs text-white/40 uppercase tracking-widest font-mono mb-2 block">{f.label}</label>
              <input
                type={f.type}
                placeholder={f.placeholder}
                value={form[f.key as keyof typeof form]}
                onChange={e => set(f.key, e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-green-500/45 transition-colors"
              />
            </div>
          ))}

          <div>
            <label className="text-xs text-white/40 uppercase tracking-widest font-mono mb-2 block">Тип сервера</label>
            <select value={form.type} onChange={e => set("type", e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-green-500/45 transition-colors">
              {TYPES.slice(1).map(t => <option key={t} value={t} className="bg-[#0d1117]">{t}</option>)}
            </select>
          </div>

          <div>
            <label className="text-xs text-white/40 uppercase tracking-widest font-mono mb-2 block">Описание</label>
            <textarea rows={4} placeholder="Расскажи об особенностях, режимах, ивентах..."
              value={form.description} onChange={e => set("description", e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-green-500/45 resize-none transition-colors" />
          </div>

          {[
            { key: "discord", label: "Discord (необязательно)", placeholder: "discord.gg/myserver" },
            { key: "site",    label: "Сайт (необязательно)",    placeholder: "https://myserver.ru" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs text-white/40 uppercase tracking-widest font-mono mb-2 block">{f.label}</label>
              <input type="text" placeholder={f.placeholder}
                value={form[f.key as keyof typeof form]} onChange={e => set(f.key, e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-green-500/45 transition-colors" />
            </div>
          ))}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-sm">
              <Icon name="AlertCircle" size={14} />
              {error}
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading}
            className="w-full py-3.5 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 neon-glow transition-all text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {loading ? <div className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" /> : <Icon name="Plus" size={16} />}
            {loading ? "Добавляем..." : "Добавить в каталог бесплатно"}
          </button>

          <p className="text-center text-xs text-white/25 pt-1">
            Хочешь больше игроков?{" "}
            <button onClick={() => setPage("pricing")} className="text-green-400 hover:text-green-300 underline-offset-2 hover:underline">
              Выбери план продвижения
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Модалка оплаты ───────────────────────────────────────────────────────────

function PayModal({ plan, onClose }: { plan: typeof PLANS[number]; onClose: () => void }) {
  const [email, setEmail]       = useState("");
  const [serverId, setServerId] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

  const handlePay = async () => {
    if (!email.trim()) { setError("Введи email для получения чека"); return; }
    setError("");
    setLoading(true);
    try {
      // Генерируем временный order_id на фронте чтобы сразу вставить в return_url
      const tempOrderId = `mt_${plan.key}_${Date.now()}`;
      const returnUrl   = `${window.location.origin}${window.location.pathname}?order_id=${tempOrderId}`;

      const res = await fetch(`${API}/pay/init`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan:        plan.key,
          email:       email.trim(),
          server_id:   serverId ? Number(serverId) : null,
          return_url:  returnUrl,
          temp_order_id: tempOrderId,
        }),
      });
      const data = await res.json();
      if (data.payment_url) {
        // return_url уже содержит order_id — ЮКасса вернёт туда пользователя
        window.location.href = data.payment_url;
      } else {
        setError(data.error || "Ошибка создания платежа");
      }
    } catch {
      setError("Сеть недоступна. Попробуй позже.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md glass-card rounded-2xl p-7 relative" onClick={e => e.stopPropagation()}
        style={{ border: `1px solid ${plan.color}40`, boxShadow: `0 0 40px ${plan.color}15` }}>
        <button onClick={onClose} className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-colors">
          <Icon name="X" size={18} />
        </button>

        <div className="mb-6">
          <div className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: plan.color }}>Оплата через ЮКассу</div>
          <h3 className="font-display text-2xl font-bold text-white uppercase">{plan.name}</h3>
          <div className="flex items-end gap-1 mt-2">
            <span className="font-display text-4xl font-bold text-white">{plan.price}₽</span>
            <span className="text-white/30 mb-1">/месяц</span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-white/40 uppercase tracking-widest font-mono mb-2 block">Email для чека *</label>
            <input type="email" placeholder="your@email.ru" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-green-500/45 transition-colors" />
          </div>
          <div>
            <label className="text-xs text-white/40 uppercase tracking-widest font-mono mb-2 block">ID сервера (необязательно)</label>
            <input type="number" placeholder="Введи ID сервера из каталога" value={serverId} onChange={e => setServerId(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/20 text-sm focus:outline-none focus:border-green-500/45 transition-colors" />
            <p className="text-[11px] text-white/25 mt-1">После оплаты тариф применится к твоему серверу автоматически</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-xs">
              <Icon name="AlertCircle" size={13} />
              {error}
            </div>
          )}

          <button onClick={handlePay} disabled={loading}
            className="w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-200 disabled:opacity-60 flex items-center justify-center gap-2 text-black"
            style={{ background: loading ? "#666" : plan.color }}>
            {loading
              ? <><div className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" /> Создаём платёж...</>
              : <><Icon name="CreditCard" size={16} /> Оплатить {plan.price}₽</>
            }
          </button>

          <div className="flex items-center justify-center gap-2 text-[11px] text-white/25">
            <Icon name="Lock" size={11} />
            Безопасная оплата через ЮКассу
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Страница: Тарифы ─────────────────────────────────────────────────────────

function PricingPage({ setPage }: { setPage: (p: string) => void }) {
  const [selectedPlan, setSelectedPlan] = useState<typeof PLANS[number] | null>(null);

  return (
    <div className="min-h-screen pt-28 pb-16 px-5">
      {selectedPlan && <PayModal plan={selectedPlan} onClose={() => setSelectedPlan(null)} />}
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <div className="text-green-400 text-xs font-mono uppercase tracking-widest mb-3">// Продвижение</div>
          <h2 className="font-display text-5xl font-bold text-white uppercase tracking-wide mb-3">Продвижение сервера</h2>
          <p className="text-white/40 max-w-xl mx-auto text-sm leading-relaxed">
            Больше игроков — больше голосов — выше в рейтинге. Выбери пакет и прокачай свой сервер.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
          {PLANS.map(plan => (
            <div key={plan.key} className={`relative rounded-2xl p-5 flex flex-col transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1 ${
              plan.highlight ? "gold-border bg-amber-500/4 shadow-[0_0_30px_rgba(245,158,11,0.1)]" : "glass-card border border-white/8"
            }`}>
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-amber-500 text-black text-[11px] font-bold rounded-full uppercase tracking-wide whitespace-nowrap">
                  Выбор владельцев
                </div>
              )}
              <div className="mb-5">
                <div className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: plan.color }}>{plan.name}</div>
                <div className="font-display text-3xl font-bold text-white">{plan.price === "0" ? "0₽" : `${plan.price}₽`}</div>
                <div className="text-xs text-white/25">{plan.price === "0" ? "навсегда" : "в месяц"}</div>
              </div>
              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-white/60">
                    <Icon name="Check" size={12} style={{ color: plan.color }} className="flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => plan.price === "0" ? setPage("add") : setSelectedPlan(plan)}
                className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${
                  plan.highlight ? "bg-amber-500 text-black hover:bg-amber-400 gold-glow"
                  : plan.price === "0" ? "bg-white/8 text-white border border-white/12 hover:bg-white/12"
                  : "text-black font-bold hover:opacity-90"
                }`}
                style={!plan.highlight && plan.price !== "0" ? { background: plan.color } : {}}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        {/* Таблица сравнения */}
        <div className="glass-card border border-white/8 rounded-2xl overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-white/5">
            <h3 className="font-display text-xl font-bold text-white uppercase">Сравнение планов</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left px-6 py-3 text-white/40 text-xs font-semibold uppercase tracking-wider">Возможность</th>
                  {PLANS.map(p => (
                    <th key={p.key} className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider" style={{ color: p.color }}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/4">
                {[
                  ["Размещение в каталоге", true,  true,  true,  true],
                  ["Баннер сервера",         false, true,  true,  true],
                  ["Приоритет в поиске",     false, true,  true,  true],
                  ["Позиция в топе",    "Случайная","Топ-20","Топ-3","#1"],
                  ["Бонус голосов",       "×1",   "×1",  "×2",  "×3"],
                  ["Рекламный баннер",      false, false, false,  true],
                  ["Персональный менеджер", false, false, false,  true],
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-white/2 transition-colors">
                    <td className="px-6 py-3 text-white/50 text-xs">{row[0]}</td>
                    {[1,2,3,4].map(j => (
                      <td key={j} className="px-4 py-3 text-center">
                        {typeof row[j] === "boolean"
                          ? row[j] ? <Icon name="Check" size={14} className="mx-auto text-green-400" />
                                   : <Icon name="Minus" size={14} className="mx-auto text-white/15" />
                          : <span className="text-xs text-white/55">{row[j]}</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { q: "Можно платить помесячно?",       a: "Да, все платные планы оплачиваются ежемесячно. Отменить можно в любой момент." },
            { q: "Как считаются голоса?",          a: "Каждый игрок может голосовать раз в 24 часа. VIP и Premium дают бонусный множитель." },
            { q: "Когда сервер появится в каталоге?", a: "Мгновенно — без модерации! Заполнил форму, нажал кнопку — и сервер уже в списке." },
            { q: "Есть ли реферальная программа?", a: "Да! Приведи владельца сервера и получи 20% от его первой оплаты." },
          ].map((item, i) => (
            <div key={i} className="glass-card border border-white/8 rounded-xl p-5">
              <div className="font-semibold text-white text-sm mb-1">{item.q}</div>
              <div className="text-xs text-white/40 leading-relaxed">{item.a}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Страница: Успешная оплата ────────────────────────────────────────────────

const PLAN_LABELS: Record<string, { name: string; color: string; icon: string }> = {
  standard: { name: "Стандарт",  color: "#22c55e", icon: "⭐" },
  vip:      { name: "VIP",       color: "#f59e0b", icon: "👑" },
  premium:  { name: "Premium",   color: "#e879f9", icon: "💎" },
};

function PaySuccessPage({ setPage }: { setPage: (p: string) => void }) {
  const [status, setStatus]   = useState<"loading" | "paid" | "pending" | "failed">("loading");
  const [planInfo, setPlanInfo] = useState<{ plan: string; amount: string } | null>(null);

  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const orderId = params.get("order_id");
    if (!orderId) { setStatus("failed"); return; }

    const check = async () => {
      try {
        const res  = await fetch(`${API}/pay/status?order_id=${orderId}`);
        const data = await res.json();
        setPlanInfo({ plan: data.plan, amount: data.amount });
        if (data.status === "paid")    setStatus("paid");
        else if (data.status === "failed") setStatus("failed");
        else setStatus("pending");
      } catch {
        setStatus("failed");
      }
    };

    check();
    // Если pending — перепроверяем каждые 3 сек (макс 5 раз)
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const res  = await fetch(`${API}/pay/status?order_id=${orderId}`).catch(() => null);
      if (!res) return;
      const data = await res.json();
      if (data.status === "paid") { setStatus("paid"); clearInterval(interval); }
      if (data.status === "failed" || attempts >= 5) { clearInterval(interval); }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const info = planInfo ? PLAN_LABELS[planInfo.plan] : null;

  return (
    <div className="min-h-screen pt-28 pb-16 px-5 flex items-center justify-center relative">
      <div className="absolute inset-0 grid-bg opacity-30" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{ background: status === "paid" ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.06)" }} />

      <div className="relative z-10 max-w-md w-full text-center">
        {status === "loading" && (
          <>
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-6">
              <div className="w-7 h-7 rounded-full border-2 border-green-500/30 border-t-green-400 animate-spin" />
            </div>
            <h2 className="font-display text-3xl font-bold text-white uppercase mb-2">Проверяем оплату</h2>
            <p className="text-white/40 text-sm">Получаем подтверждение от ЮКассы...</p>
          </>
        )}

        {status === "paid" && (
          <>
            {/* Конфетти-эффект */}
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full neon-glow animate-ping opacity-20"
                style={{ background: info?.color || "#22c55e" }} />
              <div className="relative w-20 h-20 rounded-full flex items-center justify-center text-4xl"
                style={{ background: `${info?.color || "#22c55e"}18`, border: `1px solid ${info?.color || "#22c55e"}40` }}>
                {info?.icon || "✅"}
              </div>
            </div>

            <div className="text-xs font-mono uppercase tracking-widest mb-2 slide-up"
              style={{ color: info?.color || "#22c55e" }}>
              Оплата прошла успешно
            </div>
            <h2 className="font-display text-4xl font-bold text-white uppercase tracking-wide mb-3 slide-up d1">
              Тариф {info?.name || ""} активирован!
            </h2>
            <p className="text-white/45 text-sm mb-8 slide-up d2">
              Твой сервер уже поднялся в рейтинге. Игроки начнут находить его быстрее — проверь каталог!
            </p>

            {/* Что дальше */}
            <div className="glass-card border border-white/8 rounded-2xl p-5 mb-6 text-left slide-up d3">
              <div className="text-xs text-white/35 font-mono uppercase tracking-widest mb-3">Что теперь происходит</div>
              {[
                { icon: "TrendingUp", text: "Сервер поднялся в топ каталога" },
                { icon: "Star",       text: "Значок тарифа появился на карточке" },
                { icon: "Users",      text: "Больше игроков видят твой сервер" },
                { icon: "Mail",       text: "Чек отправлен на указанный email" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${info?.color || "#22c55e"}15` }}>
                    <Icon name={item.icon} size={13} style={{ color: info?.color || "#22c55e" }} />
                  </div>
                  <span className="text-sm text-white/65">{item.text}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-center slide-up d4">
              <button onClick={() => setPage("home")}
                className="px-6 py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 neon-glow transition-all hover:scale-105">
                В каталог
              </button>
              <button onClick={() => setPage("pricing")}
                className="px-6 py-3 bg-white/6 border border-white/10 text-white/70 font-semibold rounded-xl hover:bg-white/10 transition-all">
                Тарифы
              </button>
            </div>
          </>
        )}

        {status === "pending" && (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto mb-6 text-3xl">
              ⏳
            </div>
            <h2 className="font-display text-3xl font-bold text-white uppercase mb-2">Ожидаем подтверждения</h2>
            <p className="text-white/40 text-sm mb-6">Платёж обрабатывается. Обычно это занимает до 1 минуты.</p>
            <div className="flex items-center justify-center gap-2 text-amber-400 text-xs mb-6">
              <div className="w-3 h-3 rounded-full border border-amber-400 border-t-transparent animate-spin" />
              Автоматически обновляем статус...
            </div>
            <button onClick={() => setPage("home")}
              className="px-6 py-3 bg-white/6 border border-white/10 text-white/70 font-semibold rounded-xl hover:bg-white/10 transition-all">
              Вернуться в каталог
            </button>
          </>
        )}

        {status === "failed" && (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-6 text-3xl">
              ❌
            </div>
            <h2 className="font-display text-3xl font-bold text-white uppercase mb-2">Оплата не прошла</h2>
            <p className="text-white/40 text-sm mb-6">Платёж был отменён или отклонён. Попробуй снова.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setPage("pricing")}
                className="px-6 py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 neon-glow transition-all">
                Попробовать снова
              </button>
              <button onClick={() => setPage("home")}
                className="px-6 py-3 bg-white/6 border border-white/10 text-white/70 font-semibold rounded-xl hover:bg-white/10 transition-all">
                В каталог
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Footer ────────────────────────────────────────────────────────────────────

function Footer({ setPage }: { setPage: (p: string) => void }) {
  return (
    <footer className="border-t border-white/5 py-8 px-5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <button onClick={() => setPage("home")} className="flex items-center gap-2">
          <span>⛏️</span>
          <span className="font-display font-bold text-white/60 tracking-wider">Mine<span className="text-green-400">Top</span></span>
        </button>
        <div className="flex gap-6 text-xs text-white/25">
          <button onClick={() => setPage("home")}    className="hover:text-white/50 transition-colors">Каталог</button>
          <button onClick={() => setPage("add")}     className="hover:text-white/50 transition-colors">Добавить сервер</button>
          <button onClick={() => setPage("pricing")} className="hover:text-white/50 transition-colors">Тарифы</button>
          <span>Правила</span>
          <span>Поддержка</span>
        </div>
        <div className="text-xs text-white/18">© 2024 MineED.ru</div>
      </div>
    </footer>
  );
}

// ─── Root ──────────────────────────────────────────────────────────────────────

export default function Index() {
  // Определяем страницу по URL-параметрам (после редиректа с ЮКассы)
  const [page, setPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("order_id")) return "pay-success";
    return "home";
  });

  const navigate = (p: string) => {
    // Убираем query-параметры при навигации
    if (p !== "pay-success") {
      window.history.replaceState({}, "", window.location.pathname);
    }
    setPage(p);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar page={page} setPage={navigate} />
      {page === "home"        && <HomePage       setPage={navigate} />}
      {page === "add"         && <AddServerPage  setPage={navigate} />}
      {page === "pricing"     && <PricingPage    setPage={navigate} />}
      {page === "pay-success" && <PaySuccessPage setPage={navigate} />}
      <Footer setPage={navigate} />
    </div>
  );
}