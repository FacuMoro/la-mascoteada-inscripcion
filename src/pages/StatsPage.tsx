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

type GenderCounts = {
  hombres: number;
  mujeres: number;
  sinClasificar: number;
};

type AgePyramidRow = {
  ageRange: string;
  sortOrder: number;
  hombres: number;
  mujeres: number;
  sinClasificar: number;
};

const GENDER_COLORS = {
  mujeres: "#ff7eb6",
  hombres: "#6ec1ff",
} as const;

// Solo estos rangos se grafican en la piramide. "Sin DNI" se omite del visual
// porque ensucia la lectura, pero se sigue calculando en backend.
const VISIBLE_AGE_RANGES = ["< 18", "18-29", "30-49", "50+"] as const;

const LOGO_PRINCIPAL_SRC = encodeURI("/Logo Mascoteada.png");
const POLL_MS = 8000;
const SOUND_PREF_KEY = "mascoteada-stats-sound";

/** Hook que sintetiza un campanazo alegre de 4 notas en cliente. Maneja el unlock
 *  por gesto que exigen Chrome/Safari y persiste la preferencia ON/OFF. */
function useCelebrationSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem(SOUND_PREF_KEY);
    return stored === null ? true : stored === "1";
  });
  const [unlocked, setUnlocked] = useState(false);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SOUND_PREF_KEY, value ? "1" : "0");
    }
  }, []);

  const ensureCtx = useCallback((): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!ctxRef.current) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctx) return null;
      try {
        ctxRef.current = new Ctx();
      } catch {
        return null;
      }
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    return ctx;
  }, []);

  // Cualquier gesto del usuario desbloquea el AudioContext (requerido por iOS/Chrome).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onGesture = () => {
      const ctx = ensureCtx();
      if (ctx && ctx.state === "running") {
        setUnlocked(true);
      }
    };
    window.addEventListener("pointerdown", onGesture);
    window.addEventListener("keydown", onGesture);
    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
  }, [ensureCtx]);

  const play = useCallback(() => {
    if (!enabled) return;
    const ctx = ensureCtx();
    if (!ctx || ctx.state !== "running") return;

    const now = ctx.currentTime;
    // Acorde de Do mayor ascendente + octava final, estilo "tin-tin-tin-tin!".
    const notes: Array<{ freq: number; time: number; dur: number; gain: number }> = [
      { freq: 523.25, time: 0.0, dur: 0.22, gain: 0.18 }, // C5
      { freq: 659.25, time: 0.08, dur: 0.22, gain: 0.18 }, // E5
      { freq: 783.99, time: 0.16, dur: 0.24, gain: 0.18 }, // G5
      { freq: 1046.5, time: 0.24, dur: 0.42, gain: 0.22 }, // C6
    ];

    const master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);

    notes.forEach(({ freq, time, dur, gain }) => {
      // Tono principal (triangular, suena dulce) + un armónico al octavar para "brillo".
      const osc = ctx.createOscillator();
      const shimmer = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "triangle";
      shimmer.type = "sine";
      osc.frequency.value = freq;
      shimmer.frequency.value = freq * 2;

      env.gain.setValueAtTime(0, now + time);
      env.gain.linearRampToValueAtTime(gain, now + time + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0008, now + time + dur);

      const shimmerGain = ctx.createGain();
      shimmerGain.gain.value = 0.35;
      shimmer.connect(shimmerGain).connect(env);

      osc.connect(env).connect(master);

      osc.start(now + time);
      shimmer.start(now + time);
      osc.stop(now + time + dur + 0.05);
      shimmer.stop(now + time + dur + 0.05);
    });
  }, [enabled, ensureCtx]);

  return { play, enabled, setEnabled, unlocked };
}

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4Z"
        fill="currentColor"
      />
      {on ? (
        <>
          <path
            d="M15.5 8.5a4 4 0 0 1 0 7"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M18 6a7 7 0 0 1 0 12"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </>
      ) : (
        <path
          d="M16 9.5l5 5m0-5l-5 5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

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
  const [genderCounts, setGenderCounts] = useState<GenderCounts>({
    hombres: 0,
    mujeres: 0,
    sinClasificar: 0,
  });
  const [agePyramid, setAgePyramid] = useState<AgePyramidRow[]>([]);
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
  const soundBaselineRef = useRef<Counts | null>(null);
  const sound = useCelebrationSound();

  const fetchCounts = useCallback(async (silent = false) => {
    if (!supabase) {
      setError(
        "Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.",
      );
      setLoading(false);
      return;
    }
    if (!silent) setRefreshing(true);

    // RPCs con SECURITY DEFINER que devuelven solo agregados, sin exponer datos
    // personales. La piramide etaria suma DNI -> anio de nacimiento aproximado.
    const [statsRes, genderRes, pyramidRes] = await Promise.all([
      supabase.rpc("get_mascoteada_stats"),
      supabase.rpc("get_mascoteada_gender_stats"),
      supabase.rpc("get_mascoteada_age_pyramid"),
    ]);

    if (statsRes.error) {
      setError(statsRes.error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const row = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data;
    const personas = Number(
      (row as { personas?: number | string } | null)?.personas ?? 0,
    );
    const mascotas = Number(
      (row as { mascotas?: number | string } | null)?.mascotas ?? 0,
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

    // genderRes / pyramidRes pueden fallar si la RPC todavia no se desplego; los tratamos como no-fatal.
    if (!genderRes.error) {
      const gRow = Array.isArray(genderRes.data) ? genderRes.data[0] : genderRes.data;
      setGenderCounts({
        hombres: Number((gRow as { hombres?: number | string } | null)?.hombres ?? 0),
        mujeres: Number((gRow as { mujeres?: number | string } | null)?.mujeres ?? 0),
        sinClasificar: Number(
          (gRow as { sin_clasificar?: number | string } | null)?.sin_clasificar ?? 0,
        ),
      });
    }

    if (!pyramidRes.error && Array.isArray(pyramidRes.data)) {
      const rows = (pyramidRes.data as Array<Record<string, number | string>>).map(
        (r) => ({
          ageRange: String(r.age_range ?? ""),
          sortOrder: Number(r.sort_order ?? 0),
          hombres: Number(r.hombres ?? 0),
          mujeres: Number(r.mujeres ?? 0),
          sinClasificar: Number(r.sin_clasificar ?? 0),
        }),
      );
      setAgePyramid(rows);
    }

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

  // Sonido de festejo cuando entra un registro nuevo (cualquiera de los dos sube).
  // El primer fetch fija una baseline y NO suena, para evitar el ruido al cargar la pagina.
  useEffect(() => {
    if (loading) return;
    if (soundBaselineRef.current === null) {
      soundBaselineRef.current = counts;
      return;
    }
    const prev = soundBaselineRef.current;
    if (counts.personas > prev.personas || counts.mascotas > prev.mascotas) {
      sound.play();
    }
    soundBaselineRef.current = counts;
  }, [counts, loading, sound]);

  const personasDisplay = useCountUp(counts.personas);
  const mascotasDisplay = useCountUp(counts.mascotas);

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
              onClick={() => {
                const next = !sound.enabled;
                sound.setEnabled(next);
                if (next) sound.play();
              }}
              aria-pressed={sound.enabled}
              title={
                sound.enabled
                  ? sound.unlocked
                    ? "Silenciar festejos"
                    : "Tocá la pantalla para activar el sonido"
                  : "Activar festejos"
              }
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ring-1 transition ${
                sound.enabled
                  ? "bg-mascoteada-orange/15 text-mascoteada-orange ring-mascoteada-orange/30 hover:bg-mascoteada-orange/25"
                  : "bg-white/5 text-white/55 ring-white/10 hover:bg-white/10 hover:text-white"
              }`}
            >
              <SpeakerIcon on={sound.enabled} />
              {sound.enabled
                ? sound.unlocked
                  ? "Sonido"
                  : "Tocá para activar"
                : "Silencio"}
            </button>
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
            <GenderDonutTile counts={genderCounts} />
            <AgePyramidTile rows={agePyramid} />
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

function GenderDonutTile({ counts }: { counts: GenderCounts }) {
  // Redistribuimos los "sin clasificar" en proporcion a hombres/mujeres simplemente
  // ignorandolos en el denominador: el % final ya queda repartido proporcionalmente.
  const { mujeresPct, hombresPct, totalClasificado } = useMemo(() => {
    const total = counts.hombres + counts.mujeres;
    if (total === 0) {
      return { mujeresPct: 0, hombresPct: 0, totalClasificado: 0 };
    }
    return {
      mujeresPct: (counts.mujeres / total) * 100,
      hombresPct: (counts.hombres / total) * 100,
      totalClasificado: total,
    };
  }, [counts]);

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const mujeresLen = (mujeresPct / 100) * circumference;
  const hombresLen = (hombresPct / 100) * circumference;
  const hasData = totalClasificado > 0;

  return (
    <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10 backdrop-blur-md">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">
        Distribución por género
      </p>

      <div className="mt-3 flex items-center gap-4">
        <div className="relative shrink-0">
          <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="14"
            />
            {hasData ? (
              <>
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={GENDER_COLORS.mujeres}
                  strokeWidth="14"
                  strokeDasharray={`${mujeresLen} ${circumference}`}
                  strokeDashoffset="0"
                  style={{ transition: "stroke-dasharray 600ms ease" }}
                />
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={GENDER_COLORS.hombres}
                  strokeWidth="14"
                  strokeDasharray={`${hombresLen} ${circumference}`}
                  strokeDashoffset={`${-mujeresLen}`}
                  style={{ transition: "stroke-dasharray 600ms ease, stroke-dashoffset 600ms ease" }}
                />
              </>
            ) : null}
          </svg>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <LegendRow
            color={GENDER_COLORS.mujeres}
            label="Mujeres"
            pct={mujeresPct}
            disabled={!hasData}
          />
          <LegendRow
            color={GENDER_COLORS.hombres}
            label="Hombres"
            pct={hombresPct}
            disabled={!hasData}
          />
        </div>
      </div>
    </div>
  );
}

function LegendRow({
  color,
  label,
  pct,
  disabled,
}: {
  color: string;
  label: string;
  pct: number;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm text-white/85">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: color }}
          aria-hidden
        />
        <span className="truncate">{label}</span>
      </div>
      <span className="font-bold tabular-nums">
        {disabled ? "—" : `${pct.toFixed(1)}%`}
      </span>
    </div>
  );
}

function AgePyramidTile({ rows }: { rows: AgePyramidRow[] }) {
  // Solo mostramos los rangos visibles, en orden invertido (mayor arriba, menor abajo).
  // En cada fila redistribuimos los "sin clasificar" del rango sobre M/F en proporcion
  // para que las barras reflejen el 100% de los inscriptos clasificables.
  const visible = useMemo(() => {
    const byRange = new Map(rows.map((r) => [r.ageRange, r]));
    return VISIBLE_AGE_RANGES.map((label) => {
      const r = byRange.get(label);
      if (!r) {
        return { label, hombres: 0, mujeres: 0 };
      }
      const cls = r.hombres + r.mujeres;
      if (cls === 0) {
        return { label, hombres: 0, mujeres: 0 };
      }
      const hombres = r.hombres + r.sinClasificar * (r.hombres / cls);
      const mujeres = r.mujeres + r.sinClasificar * (r.mujeres / cls);
      return { label, hombres, mujeres };
    })
      .slice()
      .reverse();
  }, [rows]);

  const max = useMemo(() => {
    let m = 0;
    for (const v of visible) {
      if (v.hombres > m) m = v.hombres;
      if (v.mujeres > m) m = v.mujeres;
    }
    return m;
  }, [visible]);

  const hasData = max > 0;

  return (
    <div className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/10 backdrop-blur-md">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">
        Pirámide etaria
      </p>

      <div className="mt-3 grid grid-cols-[1fr_42px_1fr] items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em]">
        <span className="text-right" style={{ color: GENDER_COLORS.hombres }}>
          Hombres
        </span>
        <span aria-hidden />
        <span style={{ color: GENDER_COLORS.mujeres }}>Mujeres</span>
      </div>

      <div className="mt-2 space-y-2">
        {visible.map((row) => (
          <PyramidRow key={row.label} row={row} max={max} hasData={hasData} />
        ))}
      </div>

      <p className="mt-3 text-[10px] text-white/40">
        Edad estimada por DNI · sin clasificar repartidos
      </p>
    </div>
  );
}

function PyramidRow({
  row,
  max,
  hasData,
}: {
  row: { label: string; hombres: number; mujeres: number };
  max: number;
  hasData: boolean;
}) {
  const ratioH = hasData ? row.hombres / max : 0;
  const ratioM = hasData ? row.mujeres / max : 0;

  return (
    <div className="grid grid-cols-[1fr_42px_1fr] items-center gap-1">
      <div className="flex items-center justify-end">
        <div
          className="h-3 rounded-l-full"
          style={{
            width: `${ratioH * 100}%`,
            background: GENDER_COLORS.hombres,
            transition: "width 700ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>
      <div className="text-center text-[11px] font-semibold tabular-nums text-white/70">
        {row.label}
      </div>
      <div className="flex items-center justify-start">
        <div
          className="h-3 rounded-r-full"
          style={{
            width: `${ratioM * 100}%`,
            background: GENDER_COLORS.mujeres,
            transition: "width 700ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
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

