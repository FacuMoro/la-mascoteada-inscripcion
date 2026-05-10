import {
  type CSSProperties,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import { sponsorLogoSrc } from "../sponsors";

/* ===========================================================================
 * Configuración del sorteo.
 *
 * Editá este array para cambiar / agregar / quitar premios. Un click del operador
 * por cada uno. Si alguno repite participantes (caso moto 0km), poné
 * incluyeGanadoresPrevios: true para que el pool vuelva a ser el total de inscriptos.
 * ===========================================================================
 */
type PremioConfig = {
  id: string;
  nombre: string;
  cantidad: number;
  /** Archivo del logo en /public (ej. "Logo Serin.png"). null = sin logo. */
  sponsorLogo: string | null;
  /** Color de acento del card (clase Tailwind opcional). */
  accent?: "orange" | "cream";
  /** Si true, el sorteo NO excluye a quienes ya ganaron antes (caso moto 0km). */
  incluyeGanadoresPrevios?: boolean;
  /** Texto opcional debajo del nombre. */
  detalle?: string;
  /** Duracion en ms que gira la tragamonedas. Default ANIMATION_MIN_MS (5000).
   *  Subir para premios "grandes" (ej. 10000 para la moto final). */
  duracionAnimacionMs?: number;
  /** Si true, antes de iniciar el sorteo se muestra un overlay de confirmación
   *  ("¿Listos para el gran premio?") con un CTA "VAMOS". */
  requiereConfirmacion?: boolean;
  /** Mensaje principal del overlay de confirmación. */
  textoConfirmacion?: string;
};

const PREMIOS: readonly PremioConfig[] = [
  {
    id: "bravecto-materas",
    nombre: "2 Materas Bravecto",
    cantidad: 2,
    sponsorLogo: "Logo Animal.png",
  },
  {
    id: "materojo-kit",
    nombre: "Kit de Mate · Mate Rojo",
    cantidad: 2,
    sponsorLogo: "Logo Mate Rojo.png",
  },
  {
    id: "tv-noblex-43",
    nombre: 'TV LED 43" Noblex',
    cantidad: 1,
    sponsorLogo: "Logo Animal.png",
  },
  {
    id: "moto-mondial",
    nombre: "Moto 0km Mondial Max",
    cantidad: 1,
    sponsorLogo: "Logo Animal.png",
    accent: "orange",
    incluyeGanadoresPrevios: true,
    duracionAnimacionMs: 10000,
    detalle: "El gran sorteo final",
    requiereConfirmacion: true,
    textoConfirmacion: "¿Todos listos para el gran premio?",
  },
];

/* ===========================================================================
 * Constantes y tipos
 * =========================================================================== */

const STORAGE_PASSWORD_KEY = "mascoteada-sorteo-password-v1";
const STORAGE_LAST_SORTEO_KEY = "mascoteada-sorteo-ultimo-batch-v1";
const LOGO_PRINCIPAL_SRC = encodeURI("/Logo Mascoteada.png");

const ANIMATION_MIN_MS = 5000;
const SLOT_TICK_INTERVAL_MS = 90;
/** Duraciones (en segundos) de cada reel: distintas para que no esten en fase
 *  y se vea organico. */
const SLOT_REEL_DURATIONS_S = [1.05, 1.25, 1.45] as const;
/** Cantidad de nombres por reel; se duplica internamente para loop continuo. */
const SLOT_NAMES_PER_REEL = 28;

type Ganador = {
  posicion: number;
  usuario_id: string;
  nombre: string;
  apellido: string;
  nombres_mascotas: string | null;
};

type EstadoPremio = {
  premio_id: string;
  premio_nombre: string;
  cantidad: number;
  primer_sorteo: string;
};

type ModalState =
  | { kind: "idle" }
  | { kind: "confirmando"; premio: PremioConfig }
  | { kind: "sorteando"; premio: PremioConfig; startedAt: number }
  | { kind: "revelando"; premio: PremioConfig; ganadores: Ganador[] }
  | { kind: "ver-ganadores"; premio: PremioConfig; ganadores: Ganador[] }
  | { kind: "error"; message: string };

/* ===========================================================================
 * Listas de nombres de relleno para la animación tragamonedas.
 * Solo es decorativo (no son los ganadores reales). Mezcla común de nombres
 * argentinos para que en pantalla parezca "rolando" la base de datos.
 * =========================================================================== */
const FILLER_NAMES: readonly string[] = [
  "María Soledad",
  "Juan Manuel",
  "Sofía",
  "Lucas",
  "Valentina",
  "Mateo",
  "Camila",
  "Tomás",
  "Martina",
  "Joaquín",
  "Agustina",
  "Benjamín",
  "Paula",
  "Federico",
  "Florencia",
  "Nicolás",
  "Lucía",
  "Ignacio",
  "Brenda",
  "Gonzalo",
  "Antonella",
  "Maximiliano",
  "Julieta",
  "Santiago",
  "Daniela",
  "Franco",
  "Carolina",
  "Marcos",
  "Belén",
  "Lautaro",
  "Rocío",
  "Emiliano",
  "Macarena",
  "Bautista",
  "Catalina",
  "Iván",
  "Abril",
  "Bruno",
  "Constanza",
  "Hernán",
  "Romina",
  "Milagros",
  "Pablo",
  "Yamila",
  "Andrés",
  "Mercedes",
  "Cristian",
  "Ailén",
  "Leandro",
  "Antonella",
];

const FILLER_LASTNAMES: readonly string[] = [
  "González",
  "Rodríguez",
  "Pérez",
  "Fernández",
  "López",
  "Sosa",
  "Romero",
  "Acosta",
  "Silva",
  "Benítez",
  "Cabrera",
  "Suárez",
  "Ojeda",
  "Pereyra",
  "Ledesma",
  "Vargas",
  "Aguirre",
  "Encina",
  "Quiroz",
  "Maidana",
  "Aranda",
  "Brítez",
  "Insaurralde",
  "Alegre",
  "Caballero",
];

function pickRandom<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function fillerFullName(): string {
  return `${pickRandom(FILLER_NAMES)} ${pickRandom(FILLER_LASTNAMES)}`;
}

/* ===========================================================================
 * Hook: campanazo de victoria (sintetizado, no requiere assets).
 * Mismo "feel" que el de StatsPage pero independiente.
 * =========================================================================== */
function useFanfare() {
  const ctxRef = useRef<AudioContext | null>(null);

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
    if (ctx && ctx.state === "suspended") {
      void ctx.resume();
    }
    return ctx;
  }, []);

  const playReveal = useCallback(() => {
    const ctx = ensureCtx();
    if (!ctx || ctx.state !== "running") return;
    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, t: 0.0, dur: 0.18 },
      { freq: 659.25, t: 0.1, dur: 0.18 },
      { freq: 783.99, t: 0.2, dur: 0.2 },
      { freq: 1046.5, t: 0.32, dur: 0.55 },
      { freq: 1318.51, t: 0.42, dur: 0.6 },
    ];
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    notes.forEach(({ freq, t, dur }) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      env.gain.setValueAtTime(0, now + t);
      env.gain.linearRampToValueAtTime(0.22, now + t + 0.012);
      env.gain.exponentialRampToValueAtTime(0.0008, now + t + dur);
      osc.connect(env).connect(master);
      osc.start(now + t);
      osc.stop(now + t + dur + 0.05);
    });
  }, [ensureCtx]);

  const playTick = useCallback(() => {
    const ctx = ensureCtx();
    if (!ctx || ctx.state !== "running") return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880 + Math.random() * 200;
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.05, now + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0005, now + 0.05);
    osc.connect(env).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }, [ensureCtx]);

  return { playReveal, playTick, ensureCtx };
}

/* ===========================================================================
 * Confetti minimalista (independiente del CelebrationOverlay del form).
 * =========================================================================== */
const CONFETTI_COLORS = [
  "#fe8627",
  "#ffd792",
  "#ffffff",
  "#fb923c",
  "#fde68a",
  "#fbbf24",
];

type ConfettiPiece = {
  id: number;
  left: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  drift: number;
  rotate: number;
  rotateStart: number;
  shape: "square" | "rect" | "circle";
};

function buildConfetti(count: number): ConfettiPiece[] {
  const shapes: ConfettiPiece["shape"][] = ["square", "rect", "rect", "circle"];
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    size: 8 + Math.round(Math.random() * 12),
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    delay: Math.random() * 0.8,
    duration: 3.0 + Math.random() * 2.5,
    drift: Math.round((Math.random() - 0.5) * 320),
    rotate: 360 + Math.round(Math.random() * 1080),
    rotateStart: Math.round(Math.random() * 180),
    shape: shapes[i % shapes.length],
  }));
}

function ConfettiLayer({ count = 110 }: { count?: number }) {
  const pieces = useMemo(() => buildConfetti(count), [count]);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="celebration-piece absolute top-0"
          style={{
            left: `${p.left}%`,
            width: p.shape === "rect" ? p.size * 0.6 : p.size,
            height: p.shape === "rect" ? p.size * 1.4 : p.size,
            backgroundColor: p.color,
            borderRadius: p.shape === "circle" ? "9999px" : "2px",
            transform: `rotate(${p.rotateStart}deg)`,
            "--confetti-duration": `${p.duration}s`,
            "--confetti-delay": `${p.delay}s`,
            "--confetti-drift": `${p.drift}px`,
            "--confetti-rotate": `${p.rotate}deg`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

/* ===========================================================================
 * Helpers
 * =========================================================================== */

function formatNumber(n: number): string {
  return new Intl.NumberFormat("es-AR").format(n);
}

function safeMessage(err: unknown): string {
  if (!err) return "Error desconocido";
  if (typeof err === "string") return err;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message?: unknown }).message ?? "Error");
  }
  return "Error desconocido";
}

function pluralizar(n: number, singular: string, plural: string): string {
  return n === 1 ? singular : plural;
}

/* ===========================================================================
 * Componente principal
 * =========================================================================== */
export default function SortearPage() {
  const [password, setPassword] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(STORAGE_PASSWORD_KEY);
  });

  if (!password) {
    return (
      <PasswordGate
        onAuth={(pwd) => {
          window.localStorage.setItem(STORAGE_PASSWORD_KEY, pwd);
          setPassword(pwd);
        }}
      />
    );
  }

  return (
    <SortearAutenticado
      password={password}
      onLogout={() => {
        window.localStorage.removeItem(STORAGE_PASSWORD_KEY);
        setPassword(null);
      }}
    />
  );
}

/* ===========================================================================
 * Pantalla de password
 * =========================================================================== */
function PasswordGate({ onAuth }: { onAuth: (password: string) => void }) {
  const [input, setInput] = useState("");
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError("Supabase no configurado.");
      return;
    }
    const pwd = input.trim();
    if (!pwd) {
      setError("Ingresá la contraseña.");
      return;
    }
    setValidating(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("get_sorteo_pool_size", {
      p_password: pwd,
      p_incluye_ganadores_previos: false,
    });
    setValidating(false);
    if (rpcError) {
      setError("Contraseña incorrecta.");
      return;
    }
    onAuth(pwd);
  }

  return (
    <div className="min-h-dvh min-h-screen bg-black font-display text-white">
      <div className="mx-auto flex min-h-dvh min-h-screen max-w-md flex-col items-center justify-center px-6 py-12">
        <img
          src={LOGO_PRINCIPAL_SRC}
          alt="La Mascoteada"
          className="h-auto w-full max-w-xs object-contain"
        />
        <h1 className="mt-8 text-center text-3xl font-bold tracking-tight">
          Panel de Sorteos
        </h1>
        <p className="mt-3 text-center text-base text-white/65">
          Ingresá la contraseña para administrar los sorteos del evento.
        </p>

        <form onSubmit={onSubmit} className="mt-8 w-full">
          <label className="block text-sm font-semibold uppercase tracking-[0.18em] text-white/60">
            Contraseña
            <input
              type="password"
              autoFocus
              autoComplete="off"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="mt-2 block w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-white/30 outline-none transition focus:border-mascoteada-orange focus:ring-2 focus:ring-mascoteada-orange/35"
              placeholder="••••••••"
            />
          </label>

          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={validating}
            className="mt-6 w-full rounded-2xl bg-mascoteada-orange px-4 py-3 text-base font-semibold text-white shadow-lg shadow-mascoteada-orange/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {validating ? "Verificando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ===========================================================================
 * Pantalla principal autenticada
 * =========================================================================== */
function SortearAutenticado({
  password,
  onLogout,
}: {
  password: string;
  onLogout: () => void;
}) {
  const [estado, setEstado] = useState<EstadoPremio[]>([]);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ kind: "idle" });
  const [pickerAbierto, setPickerAbierto] = useState(false);
  const fanfare = useFanfare();

  const refrescar = useCallback(async () => {
    if (!supabase) {
      setErrorCarga("Supabase no configurado.");
      return;
    }
    setErrorCarga(null);
    const estadoRes = await supabase.rpc("get_sorteo_estado", {
      p_password: password,
    });

    if (estadoRes.error) {
      setErrorCarga(estadoRes.error.message);
    } else if (Array.isArray(estadoRes.data)) {
      setEstado(estadoRes.data as EstadoPremio[]);
    }
  }, [password]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del estado, idem patrón de StatsPage
    refrescar();
  }, [refrescar]);

  const estadoPorPremio = useMemo(() => {
    const map = new Map<string, EstadoPremio>();
    for (const e of estado) map.set(e.premio_id, e);
    return map;
  }, [estado]);

  // El proximo premio a sortear es el primero del array PREMIOS que todavia
  // no fue sorteado. El array define el ORDEN, asi que reordenando ese array
  // se cambia el orden del show.
  const siguientePremio = useMemo(() => {
    return PREMIOS.find((p) => !estadoPorPremio.has(p.id)) ?? null;
  }, [estadoPorPremio]);

  /* ---------- Acciones ---------- */

  function solicitarSorteo(premio: PremioConfig) {
    if (premio.requiereConfirmacion) {
      setModal({ kind: "confirmando", premio });
      return;
    }
    void iniciarSorteo(premio);
  }

  async function iniciarSorteo(premio: PremioConfig) {
    if (!supabase) return;
    setModal({ kind: "sorteando", premio, startedAt: Date.now() });

    const startedAt = Date.now();
    try {
      const { data, error } = await supabase.rpc("sortear_premio", {
        p_password: password,
        p_premio_id: premio.id,
        p_premio_nombre: premio.nombre,
        p_cantidad: premio.cantidad,
        p_incluye_ganadores_previos: !!premio.incluyeGanadoresPrevios,
      });

      if (error) {
        setModal({ kind: "error", message: error.message });
        return;
      }

      const ganadores = (data ?? []) as Ganador[];
      // Aseguramos que la animación dure al menos lo configurado por premio
      // (default ANIMATION_MIN_MS) para que tenga "drama" aunque el server
      // responda en 50ms. La moto final usa 10s para mas tension.
      const targetMs = premio.duracionAnimacionMs ?? ANIMATION_MIN_MS;
      const elapsed = Date.now() - startedAt;
      const wait = Math.max(0, targetMs - elapsed);
      await new Promise((r) => setTimeout(r, wait));

      window.localStorage.setItem(
        STORAGE_LAST_SORTEO_KEY,
        JSON.stringify({ premioId: premio.id, ts: Date.now() }),
      );

      setModal({ kind: "revelando", premio, ganadores });
      fanfare.playReveal();
      await refrescar();
    } catch (err) {
      setModal({ kind: "error", message: safeMessage(err) });
    }
  }

  async function verGanadores(premio: PremioConfig) {
    if (!supabase) return;
    const { data, error } = await supabase.rpc("get_sorteo_ganadores", {
      p_password: password,
      p_premio_id: premio.id,
    });
    if (error) {
      setModal({ kind: "error", message: error.message });
      return;
    }
    setModal({
      kind: "ver-ganadores",
      premio,
      ganadores: (data ?? []) as Ganador[],
    });
  }

  async function deshacerSorteo(premio: PremioConfig) {
    if (!supabase) return;
    const ok = window.confirm(
      `¿Estás seguro de DESHACER el sorteo de "${premio.nombre}"? Se borrarán todos los ganadores y se podrá volver a sortear.`,
    );
    if (!ok) return;
    const { error } = await supabase.rpc("deshacer_sorteo", {
      p_password: password,
      p_premio_id: premio.id,
    });
    if (error) {
      window.alert(`Error al deshacer: ${error.message}`);
      return;
    }
    await refrescar();
  }

  /* ---------- Render ---------- */

  return (
    <div className="relative min-h-dvh min-h-screen overflow-hidden bg-black font-display text-white">
      {/* Halo naranja decorativo arriba (envuelve toda la viewport del hero) */}
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden
        style={{
          background:
            "radial-gradient(70% 60% at 50% 30%, rgba(254,134,39,0.32) 0%, rgba(0,0,0,0) 75%)",
        }}
      />

      {/* Iconos de admin discretos (apenas se ven a distancia desde la sala). */}
      <div className="absolute right-3 top-3 z-30 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setPickerAbierto(true)}
          aria-label="Lista de premios"
          title="Lista de premios"
          className="rounded-full p-2 text-white/15 transition hover:text-white/70 focus:text-white/70 focus:outline-none"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
            <path
              d="M4 6h16M4 12h16M4 18h16"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={onLogout}
          aria-label="Salir"
          title="Salir"
          className="rounded-full p-2 text-white/15 transition hover:text-white/70 focus:text-white/70 focus:outline-none"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
            <path
              d="M15 17l5-5-5-5M9 12h11M11 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Hero pantalla completa */}
      <main className="relative z-10 flex min-h-dvh min-h-screen flex-col items-center justify-center gap-10 px-6 py-12 text-center sm:gap-14 sm:py-16">
        <img
          src={LOGO_PRINCIPAL_SRC}
          alt="La Mascoteada"
          className="h-auto w-full max-w-[min(80vw,560px)] object-contain drop-shadow-[0_10px_40px_rgba(254,134,39,0.25)] sm:max-w-[640px]"
        />

        <div className="flex flex-col items-center gap-3">
          <p className="text-sm font-bold uppercase tracking-[0.5em] text-mascoteada-orange sm:text-base sm:tracking-[0.6em]">
            Sorteos en Vivo
          </p>
        </div>

        {siguientePremio ? (
          <button
            type="button"
            onClick={() => {
              solicitarSorteo(siguientePremio);
            }}
            className="hero-cta inline-flex items-center justify-center gap-4 rounded-full bg-mascoteada-orange px-12 py-6 text-2xl font-black uppercase tracking-[0.32em] text-white shadow-[0_20px_60px_rgba(254,134,39,0.45)] ring-4 ring-mascoteada-orange/20 transition hover:brightness-110 active:scale-[0.97] sm:px-20 sm:py-8 sm:text-3xl sm:tracking-[0.4em]"
          >
            <SparkIcon />
            Sortear
          </button>
        ) : (
          <div className="inline-flex flex-col items-center gap-2 rounded-3xl border border-white/10 bg-white/[0.04] px-10 py-6 text-center backdrop-blur sm:px-14 sm:py-8">
            <p className="text-base font-bold uppercase tracking-[0.32em] text-mascoteada-cream sm:text-lg sm:tracking-[0.4em]">
              ¡Sorteos finalizados!
            </p>
            <p className="text-sm text-white/55">
              Gracias por participar
            </p>
          </div>
        )}

        {errorCarga ? (
          <p
            role="alert"
            className="mx-auto max-w-xl rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-3 text-sm text-red-200"
          >
            {errorCarga}
          </p>
        ) : null}
      </main>

      {/* Picker (admin) accesible solo via icono discreto. Sirve para
          ver ganadores de un premio anterior o deshacer un sorteo. */}
      {pickerAbierto ? (
        <PickerPremios
          estadoPorPremio={estadoPorPremio}
          onCerrar={() => setPickerAbierto(false)}
          onSortear={(premio) => {
            setPickerAbierto(false);
            solicitarSorteo(premio);
          }}
          onVerGanadores={(premio) => verGanadores(premio)}
          onDeshacer={(premio) => deshacerSorteo(premio)}
        />
      ) : null}

      {modal.kind === "confirmando" ? (
        <ConfirmacionPremioOverlay
          premio={modal.premio}
          onConfirmar={() => {
            void iniciarSorteo(modal.premio);
          }}
          onCancelar={() => setModal({ kind: "idle" })}
        />
      ) : null}

      {modal.kind === "sorteando" ? (
        <SorteandoOverlay
          premio={modal.premio}
          onTick={fanfare.playTick}
        />
      ) : null}

      {modal.kind === "revelando" ? (
        <RevelacionOverlay
          premio={modal.premio}
          ganadores={modal.ganadores}
          onClose={() => {
            setModal({ kind: "idle" });
            setPickerAbierto(false);
          }}
        />
      ) : null}

      {modal.kind === "ver-ganadores" ? (
        <RevelacionOverlay
          premio={modal.premio}
          ganadores={modal.ganadores}
          modoRevista
          onClose={() => setModal({ kind: "idle" })}
        />
      ) : null}

      {modal.kind === "error" ? (
        <ErrorOverlay
          message={modal.message}
          onClose={() => setModal({ kind: "idle" })}
        />
      ) : null}
    </div>
  );
}

/* ===========================================================================
 * Picker: grilla de premios pantalla completa
 * =========================================================================== */
function PickerPremios({
  estadoPorPremio,
  onCerrar,
  onSortear,
  onVerGanadores,
  onDeshacer,
}: {
  estadoPorPremio: Map<string, EstadoPremio>;
  onCerrar: () => void;
  onSortear: (premio: PremioConfig) => void;
  onVerGanadores: (premio: PremioConfig) => void;
  onDeshacer: (premio: PremioConfig) => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex flex-col overflow-y-auto bg-black"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(254,134,39,0.25) 0%, rgba(0,0,0,0) 75%)",
        }}
      />

      <button
        type="button"
        onClick={onCerrar}
        aria-label="Volver"
        title="Volver"
        className="absolute left-3 top-3 z-10 inline-flex items-center gap-2 rounded-full px-3 py-2 text-white/35 transition hover:text-white/85 focus:text-white/85 focus:outline-none"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <path
            d="M15 6l-6 6 6 6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="text-xs font-semibold uppercase tracking-[0.22em]">
          Volver
        </span>
      </button>

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16 sm:px-12">
        <p className="text-xs font-bold uppercase tracking-[0.42em] text-mascoteada-orange sm:text-sm">
          Elegí un premio
        </p>

        <ul className="mt-10 grid w-full max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PREMIOS.map((premio) => {
            const yaSorteado = estadoPorPremio.get(premio.id);
            return (
              <PremioCard
                key={premio.id}
                premio={premio}
                yaSorteado={!!yaSorteado}
                onSortear={() => onSortear(premio)}
                onVerGanadores={() => onVerGanadores(premio)}
                onDeshacer={() => onDeshacer(premio)}
              />
            );
          })}
        </ul>
      </div>
    </div>
  );
}

/* ===========================================================================
 * Card de un premio
 * =========================================================================== */
function PremioCard({
  premio,
  yaSorteado,
  onSortear,
  onVerGanadores,
  onDeshacer,
}: {
  premio: PremioConfig;
  yaSorteado: boolean;
  onSortear: () => void;
  onVerGanadores: () => void;
  onDeshacer: () => void;
}) {
  const accent = premio.accent ?? "orange";
  return (
    <li
      className={`group relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur transition hover:border-white/25 ${
        yaSorteado ? "opacity-90" : ""
      }`}
    >
      <div className="flex items-start gap-4">
        {premio.sponsorLogo ? (
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-white/95 p-2 shadow-md">
            <img
              src={sponsorLogoSrc(premio.sponsorLogo)}
              alt=""
              className="max-h-full max-w-full object-contain"
              loading="lazy"
            />
          </div>
        ) : (
          <div
            className={`flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl ${
              accent === "orange"
                ? "bg-mascoteada-orange/15 text-mascoteada-orange"
                : "bg-mascoteada-cream/15 text-mascoteada-cream"
            }`}
          >
            <GiftIcon />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p
            className={`text-xs font-bold uppercase tracking-[0.22em] ${
              accent === "orange"
                ? "text-mascoteada-orange"
                : "text-mascoteada-cream"
            }`}
          >
            {formatNumber(premio.cantidad)}{" "}
            {pluralizar(premio.cantidad, "ganador", "ganadores")}
          </p>
          <h3 className="mt-1 text-xl font-bold leading-tight">
            {premio.nombre}
          </h3>
          {premio.detalle ? (
            <p className="mt-1.5 text-sm text-white/55">{premio.detalle}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {yaSorteado ? (
          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={onVerGanadores}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/15"
            >
              <CheckIcon />
              Ver ganadores
            </button>
            <button
              type="button"
              onClick={onDeshacer}
              aria-label="Deshacer este sorteo"
              title="Deshacer este sorteo"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-white/20 transition hover:text-white/70 focus:text-white/70 focus:outline-none"
            >
              <UndoIcon />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSortear}
            className={`group/btn relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-2xl px-4 py-3.5 text-base font-bold uppercase tracking-[0.18em] transition active:scale-[0.98] ${
              accent === "orange"
                ? "bg-mascoteada-orange text-white shadow-lg shadow-mascoteada-orange/30 hover:brightness-105"
                : "bg-mascoteada-cream text-black shadow-lg shadow-mascoteada-cream/25 hover:brightness-105"
            }`}
          >
            <SparkIcon />
            Sortear
          </button>
        )}
      </div>
    </li>
  );
}

/* ===========================================================================
 * Overlay: Confirmación previa al gran premio. Pop-up grande y festivo con
 * un único CTA "VAMOS" para arrancar el sorteo. Le da dramatismo al momento.
 * =========================================================================== */
function ConfirmacionPremioOverlay({
  premio,
  onConfirmar,
  onCancelar,
}: {
  premio: PremioConfig;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const titulo = premio.textoConfirmacion ?? "¿Listos para el gran premio?";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[75] flex flex-col items-center justify-center overflow-hidden bg-black/95 px-6 text-white"
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(60% 50% at 50% 45%, rgba(254,134,39,0.42) 0%, rgba(0,0,0,0) 70%)",
        }}
      />

      <button
        type="button"
        onClick={onCancelar}
        aria-label="Cancelar"
        className="absolute right-6 top-6 z-20 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-white/55 transition hover:bg-white/10 hover:text-white"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden>
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-10 text-center">
        {premio.sponsorLogo ? (
          <div className="flex h-56 w-auto items-center justify-center rounded-3xl bg-white px-12 py-8 shadow-[0_30px_80px_rgba(254,134,39,0.35)] ring-1 ring-white/10 sm:h-72 sm:px-20 sm:py-10">
            <img
              src={sponsorLogoSrc(premio.sponsorLogo)}
              alt=""
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : null}

        <div className="flex flex-col items-center gap-4">
          <p className="text-sm font-bold uppercase tracking-[0.5em] text-mascoteada-orange sm:text-base sm:tracking-[0.6em]">
            Gran premio
          </p>
          <h2 className="text-4xl font-black leading-tight sm:text-6xl md:text-7xl">
            {titulo}
          </h2>
          <p className="text-xl font-bold text-white/85 sm:text-3xl">
            {premio.nombre}
          </p>
          {premio.detalle ? (
            <p className="text-base text-white/55 sm:text-lg">
              {premio.detalle}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          autoFocus
          onClick={onConfirmar}
          className="hero-cta inline-flex items-center justify-center gap-4 rounded-full bg-mascoteada-orange px-16 py-7 text-3xl font-black uppercase tracking-[0.42em] text-white shadow-[0_20px_60px_rgba(254,134,39,0.55)] ring-4 ring-mascoteada-orange/25 transition hover:brightness-110 active:scale-[0.97] sm:px-24 sm:py-9 sm:text-4xl sm:tracking-[0.5em]"
        >
          <SparkIcon />
          Vamos
        </button>
      </div>
    </div>
  );
}

/* ===========================================================================
 * Modal: animación de sorteo - tragamonedas tipo casino con 3 reels verticales
 * que ocupan casi toda la pantalla. Gira ~5s y luego transiciona al reveal.
 * =========================================================================== */
function SorteandoOverlay({
  premio,
  onTick,
}: {
  premio: PremioConfig;
  onTick: () => void;
}) {
  // Generamos 3 reels independientes con nombres random unica vez por modal.
  const reels = useMemo(
    () =>
      SLOT_REEL_DURATIONS_S.map((duration) => ({
        duration,
        names: Array.from({ length: SLOT_NAMES_PER_REEL }, fillerFullName),
      })),
    [],
  );

  // Tick de sonido continuo durante la tirada (le da el "tac tac tac" del casino).
  useEffect(() => {
    const interval = setInterval(onTick, SLOT_TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [onTick]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-black text-white">
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(70% 60% at 50% 50%, rgba(254,134,39,0.28) 0%, rgba(0,0,0,0) 75%)",
        }}
      />

      {/* Header compacto */}
      <header className="relative z-10 shrink-0 px-6 pt-5 text-center sm:pt-7">
        <p className="text-xs font-bold uppercase tracking-[0.42em] text-mascoteada-orange sm:text-sm">
          Sorteando
        </p>
        <h2 className="mt-2 text-2xl font-bold leading-tight sm:text-4xl">
          {premio.nombre}
        </h2>
      </header>

      {/* Tragamonedas: ocupa casi toda la pantalla de arriba abajo */}
      <div className="relative z-10 flex flex-1 items-stretch px-3 py-4 sm:px-8 sm:py-6">
        <div className="relative flex flex-1 items-stretch overflow-hidden rounded-3xl border-2 border-mascoteada-orange/55 bg-white/[0.03] shadow-[0_0_80px_rgba(254,134,39,0.2),inset_0_0_60px_rgba(0,0,0,0.6)]">
          {/* Linea ganadora en el centro */}
          <div
            className="pointer-events-none absolute inset-x-0 top-1/2 z-30 h-20 -translate-y-1/2 border-y-2 border-mascoteada-orange/80 bg-mascoteada-orange/10 shadow-[0_0_30px_rgba(254,134,39,0.35)] sm:h-24"
            aria-hidden
          />
          {/* Mascaras con gradiente arriba y abajo (efecto profundidad) */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-20 h-32 bg-gradient-to-b from-black/90 via-black/45 to-transparent sm:h-40"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-32 bg-gradient-to-t from-black/90 via-black/45 to-transparent sm:h-40"
            aria-hidden
          />

          {reels.map((reel, idx) => (
            <SlotReel
              key={idx}
              names={reel.names}
              duration={reel.duration}
              divider={idx > 0}
            />
          ))}
        </div>
      </div>

      {/* Footer compacto */}
      <footer className="relative z-10 shrink-0 px-6 pb-5 text-center sm:pb-7">
        <p className="inline-flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.28em] text-white/55">
          <span className="inline-flex h-2 w-2 animate-ping rounded-full bg-mascoteada-orange" />
          Eligiendo al azar...
        </p>
      </footer>
    </div>
  );
}

/** Una columna del tragamonedas. Renderiza la lista duplicada (X+X) y aplica
 *  el keyframe slot-spin (translateY 0 -> -50%) en loop continuo. */
function SlotReel({
  names,
  duration,
  divider,
}: {
  names: string[];
  duration: number;
  divider: boolean;
}) {
  // Duplicamos para que el ciclo del 50% caiga exactamente en la posicion
  // inicial de la segunda copia, evitando el "salto" al reiniciar.
  const looped = useMemo(() => [...names, ...names], [names]);
  return (
    <div
      className={`relative flex-1 overflow-hidden ${divider ? "border-l-2 border-white/10" : ""}`}
    >
      <div
        className="slot-strip absolute inset-x-0 top-0 flex flex-col"
        style={{ animationDuration: `${duration}s` }}
      >
        {looped.map((name, i) => (
          <div
            key={i}
            className="flex h-20 items-center justify-center px-3 text-center sm:h-24"
          >
            <span className="font-display text-lg font-bold leading-tight tracking-tight sm:text-2xl lg:text-3xl">
              {name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===========================================================================
 * Modal: revelación de ganadores
 * =========================================================================== */
function RevelacionOverlay({
  premio,
  ganadores,
  modoRevista = false,
  onClose,
}: {
  premio: PremioConfig;
  ganadores: Ganador[];
  modoRevista?: boolean;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-black text-white"
    >
      {!modoRevista ? <ConfettiLayer count={130} /> : null}

      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "radial-gradient(70% 60% at 50% 0%, rgba(254,134,39,0.35) 0%, rgba(0,0,0,0) 75%)",
        }}
      />

      <header className="relative z-10 px-6 pt-8 sm:px-12 sm:pt-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 text-center">
          {premio.sponsorLogo ? (
            <div className="flex h-64 w-auto items-center justify-center rounded-3xl bg-white px-12 py-8 shadow-[0_20px_60px_rgba(0,0,0,0.4)] ring-1 ring-white/10 sm:h-80 sm:px-20 sm:py-10">
              <img
                src={sponsorLogoSrc(premio.sponsorLogo)}
                alt=""
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : null}
          <p className="text-xs font-bold uppercase tracking-[0.42em] text-mascoteada-orange sm:text-sm">
            {modoRevista
              ? pluralizar(ganadores.length, "Ganador", "Ganadores")
              : `¡${pluralizar(ganadores.length, "Ganador", "Ganadores")}!`}
          </p>
          <h2 className="text-2xl font-bold leading-tight sm:text-4xl">
            {premio.nombre}
          </h2>
          <p className="text-base text-white/55 sm:text-lg">
            {formatNumber(ganadores.length)}{" "}
            {pluralizar(ganadores.length, "ganador", "ganadores")}
          </p>
        </div>
      </header>

      <div className="relative z-10 flex-1 overflow-y-auto px-6 pb-32 pt-8 sm:px-12">
        <ul className="mx-auto flex w-full max-w-6xl flex-wrap justify-center gap-3">
          {ganadores.map((g, idx) => {
            const basisClase =
              ganadores.length <= 3
                ? "w-full max-w-sm sm:basis-[calc(33.333%-0.5rem)]"
                : ganadores.length <= 12
                  ? "basis-[calc(50%-0.375rem)] sm:basis-[calc(33.333%-0.5rem)] md:basis-[calc(25%-0.5625rem)]"
                  : "basis-[calc(50%-0.375rem)] sm:basis-[calc(33.333%-0.5rem)] md:basis-[calc(25%-0.5625rem)] lg:basis-[calc(20%-0.6rem)]";
            return (
              <li
                key={g.usuario_id}
                className={`flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-center backdrop-blur ${basisClase} ${
                  modoRevista ? "" : "winner-drop"
                }`}
                style={
                  modoRevista
                    ? undefined
                    : ({
                        "--winner-delay": `${Math.min(idx * 45, 1800)}ms`,
                      } as CSSProperties)
                }
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-mascoteada-orange">
                  #{g.posicion}
                </span>
                <p className="mt-1 text-base font-bold leading-tight sm:text-lg">
                  {g.nombre} {g.apellido}
                </p>
                {g.nombres_mascotas ? (
                  <p className="mt-0.5 truncate text-xs text-white/55">
                    con {g.nombres_mascotas}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <footer className="absolute inset-x-0 bottom-0 z-20 border-t border-white/10 bg-black/85 px-6 py-5 backdrop-blur sm:px-12">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <p className="text-sm font-semibold text-white/65">
            {modoRevista
              ? "¡Felicitaciones a los ganadores!"
              : "¡Felicitaciones a todos los ganadores!"}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl bg-white px-6 py-3 text-sm font-bold uppercase tracking-[0.18em] text-black transition hover:brightness-95"
          >
            Cerrar
          </button>
        </div>
      </footer>
    </div>
  );
}

/* ===========================================================================
 * Modal: error
 * =========================================================================== */
function ErrorOverlay({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 px-4 py-6"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-6 text-black shadow-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-red-600">
          Algo salió mal
        </p>
        <p className="mt-3 text-base text-black/75">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-black px-4 py-3 text-base font-semibold text-white transition hover:brightness-110"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

/* ===========================================================================
 * Iconos
 * =========================================================================== */
function GiftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7" aria-hidden>
      <path
        d="M20 7H4v4h16V7Zm-1 6H5v8h14v-8ZM12 7v14M8 7c-1.5 0-3-1-3-2.5S6.5 2 8 2s4 5 4 5-2.5 0-4 0Zm8 0c1.5 0 3-1 3-2.5S17.5 2 16 2s-4 5-4 5 2.5 0 4 0Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <path
        d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M5 12.5l4 4 10-10"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="M9 14l-4-4 4-4M5 10h9a5 5 0 0 1 0 10h-3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
