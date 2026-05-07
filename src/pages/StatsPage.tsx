import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../lib/supabase";

type Counts = {
  personas: number;
  mascotas: number;
};

const LOGO_PRINCIPAL_SRC = encodeURI("/Logo Mascoteada.png");
const POLL_MS = 8000;

/** Cuenta progresiva con easing easeOutCubic. */
function useCountUp(target: number, duration = 1100): number {
  const [value, setValue] = useState(target);
  const previousRef = useRef(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = previousRef.current;
    const to = target;
    if (from === to) {
      setValue(to);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        previousRef.current = to;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat("es-AR").format(n);
}

function relativeTime(diffMs: number): string {
  if (diffMs < 1500) return "recién";
  const s = Math.floor(diffMs / 1000);
  if (s < 60) return `hace ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  return `hace ${h} h`;
}

type StatCardProps = {
  label: string;
  value: number;
  displayValue: number;
  tone: "orange" | "cream";
  icon: React.ReactNode;
  pulse: boolean;
};

function StatCard({ label, value, displayValue, tone, icon, pulse }: StatCardProps) {
  const toneStyles =
    tone === "orange"
      ? {
          ring: "ring-mascoteada-orange/30",
          glow: "from-mascoteada-orange/35 via-mascoteada-orange/10 to-transparent",
          accent: "text-mascoteada-orange",
          chip: "bg-mascoteada-orange/15 text-mascoteada-orange",
          dot: "bg-mascoteada-orange",
        }
      : {
          ring: "ring-mascoteada-cream/40",
          glow: "from-mascoteada-cream/35 via-mascoteada-cream/10 to-transparent",
          accent: "text-mascoteada-cream",
          chip: "bg-mascoteada-cream/15 text-mascoteada-cream",
          dot: "bg-mascoteada-cream",
        };

  return (
    <article
      className={`group stat-card relative overflow-hidden rounded-[2rem] bg-white/[0.04] p-7 ring-1 backdrop-blur-md transition sm:p-9 lg:p-10 ${toneStyles.ring}`}
    >
      <div
        className={`pointer-events-none absolute -top-32 -right-32 h-72 w-72 rounded-full bg-gradient-radial blur-3xl ${toneStyles.glow} bg-gradient-to-br`}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-screen"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
        aria-hidden
      />

      <div className="relative flex items-center justify-between">
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${toneStyles.chip}`}>
          {icon}
        </div>
        <span
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${toneStyles.chip}`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${toneStyles.dot} ${pulse ? "animate-ping" : ""}`}
            aria-hidden
          />
          En vivo
        </span>
      </div>

      <p className="relative mt-9 text-sm font-semibold uppercase tracking-[0.28em] text-white/55">
        {label}
      </p>

      <p
        key={value}
        className={`stat-number relative mt-3 font-display font-bold leading-none tracking-tight text-white ${pulse ? "stat-number--pulse" : ""}`}
        aria-live="polite"
      >
        {formatNumber(displayValue)}
      </p>

      <div
        className={`relative mt-7 h-1 w-24 rounded-full ${tone === "orange" ? "bg-mascoteada-orange" : "bg-mascoteada-cream"}`}
        aria-hidden
      />
    </article>
  );
}

function PeopleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <path
        d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0 1.5c-3.5 0-6.5 1.8-6.5 4.5V20h13v-3c0-2.7-3-4.5-6.5-4.5Z"
        fill="currentColor"
      />
      <path
        d="M16.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm.4 1.6c2.7.2 5.1 1.7 5.1 4.1V20h-5v-3c0-1.6-.7-3.1-2.1-4.4.6-.1 1.3-.1 2-.1Z"
        fill="currentColor"
        opacity="0.7"
      />
    </svg>
  );
}

function PawIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
      <circle cx="6" cy="9" r="2" fill="currentColor" />
      <circle cx="10" cy="5" r="2" fill="currentColor" />
      <circle cx="14" cy="5" r="2" fill="currentColor" />
      <circle cx="18" cy="9" r="2" fill="currentColor" />
      <path
        d="M12 11.5c-3 0-6 2.6-6 5.4 0 1.7 1.3 2.6 3 2.6 1.1 0 2-.6 3-.6s1.9.6 3 .6c1.7 0 3-.9 3-2.6 0-2.8-3-5.4-6-5.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`}
      aria-hidden
    >
      <path
        d="M20 12a8 8 0 1 1-2.34-5.66"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M20 4v5h-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function StatsPage() {
  const [counts, setCounts] = useState<Counts>({ personas: 0, mascotas: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const [pulseKey, setPulseKey] = useState<{ personas: number; mascotas: number }>({
    personas: 0,
    mascotas: 0,
  });
  const previousCountsRef = useRef<Counts>({ personas: 0, mascotas: 0 });

  const fetchCounts = useCallback(async (silent = false) => {
    if (!supabase) {
      setError(
        "Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.",
      );
      setLoading(false);
      return;
    }
    if (!silent) setRefreshing(true);
    const { data, count, error: err } = await supabase
      .from("usuarios_mascoteada")
      .select("cuantas_mascotas", { count: "exact" });

    if (err) {
      setError(err.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const personas = count ?? data?.length ?? 0;
    const mascotas = (data ?? []).reduce(
      (sum, row) =>
        sum + (Number((row as { cuantas_mascotas?: number }).cuantas_mascotas) || 0),
      0,
    );

    setCounts((prev) => {
      const next = { personas, mascotas };
      if (next.personas > prev.personas || next.mascotas > prev.mascotas) {
        setPulseKey((p) => ({
          personas: next.personas > prev.personas ? p.personas + 1 : p.personas,
          mascotas: next.mascotas > prev.mascotas ? p.mascotas + 1 : p.mascotas,
        }));
      }
      previousCountsRef.current = next;
      return next;
    });

    setError(null);
    setLastUpdate(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchCounts(true);
    const interval = setInterval(() => fetchCounts(true), POLL_MS);
    return () => clearInterval(interval);
  }, [fetchCounts]);

  // Suscripción realtime: si está habilitada para la tabla, refresca en cuanto entra un registro nuevo.
  useEffect(() => {
    const client = supabase;
    if (!client) return;
    const channel = client
      .channel("stats-mascoteada")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "usuarios_mascoteada",
        },
        () => {
          fetchCounts(true);
        },
      )
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [fetchCounts]);

  // Reloj para mostrar "hace X segundos".
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const personasDisplay = useCountUp(counts.personas);
  const mascotasDisplay = useCountUp(counts.mascotas);

  const ratio = useMemo(() => {
    if (counts.personas === 0) return 0;
    return counts.mascotas / counts.personas;
  }, [counts]);

  const lastUpdateLabel = lastUpdate
    ? relativeTime(now - lastUpdate.getTime())
    : null;

  return (
    <div className="relative min-h-dvh min-h-screen overflow-hidden bg-[#050505] text-white">
      {/* Fondo: gradientes orgánicos */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 h-[36rem] w-[36rem] rounded-full bg-mascoteada-orange/25 blur-[140px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-[36rem] w-[36rem] rounded-full bg-mascoteada-cream/15 blur-[140px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-dvh min-h-screen w-full max-w-6xl flex-col px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-14">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/5 ring-1 ring-white/10 sm:h-14 sm:w-14">
              <img
                src={LOGO_PRINCIPAL_SRC}
                alt="La Mascoteada"
                className="h-8 w-8 object-contain sm:h-10 sm:w-10"
              />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-mascoteada-orange">
                Panel interno · La Mascoteada
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                Inscripciones en tiempo real
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 ring-1 ring-white/10">
              <span className="relative inline-flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              {lastUpdateLabel ? `Actualizado ${lastUpdateLabel}` : "Conectando…"}
            </span>
            <button
              type="button"
              onClick={() => fetchCounts(false)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs font-semibold text-white/80 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshIcon spinning={refreshing} />
              Refrescar
            </button>
          </div>
        </header>

        {/* Grid principal */}
        <div className="mt-10 flex-1 sm:mt-12">
          {error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="grid gap-5 md:grid-cols-2 md:gap-6 lg:gap-8">
            <StatCard
              label="Personas registradas"
              value={counts.personas}
              displayValue={personasDisplay}
              tone="orange"
              icon={<PeopleIcon />}
              pulse={pulseKey.personas > 0}
            />
            <StatCard
              label="Mascotas registradas"
              value={counts.mascotas}
              displayValue={mascotasDisplay}
              tone="cream"
              icon={<PawIcon />}
              pulse={pulseKey.mascotas > 0}
            />
          </div>

          {/* Métricas secundarias */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3 md:mt-8">
            <MetricTile
              label="Mascotas por persona"
              value={counts.personas === 0 ? "—" : ratio.toFixed(2)}
              hint="Promedio"
            />
            <MetricTile
              label="Total individuos"
              value={formatNumber(counts.personas + counts.mascotas)}
              hint="Personas + mascotas"
            />
            <MetricTile
              label="Modo de actualización"
              value="Auto"
              hint={`Sondeo cada ${Math.round(POLL_MS / 1000)}s + realtime`}
            />
          </div>
        </div>

        <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/45">
          <span>Datos en vivo desde Supabase · Tabla usuarios_mascoteada</span>
          <span>{new Date().getFullYear()} · La Mascoteada</span>
        </footer>
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10 backdrop-blur-md">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs text-white/45">{hint}</p>
      ) : null}
    </div>
  );
}

