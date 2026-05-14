import { type CSSProperties, type SVGProps, useEffect, useState } from "react";

const ANIMAL_LOGO_SRC = encodeURI("/Logo Animal.png");

/** Fechas internas para el cómputo del progreso. El usuario NO debe ver la
 *  fecha exacta: el inicio corresponde al cierre de la edición anterior y el
 *  final coincide con la próxima edición del evento. */
const PROGRESS_START_MS = new Date("2026-05-10T20:00:00-03:00").getTime();
const PROGRESS_END_MS = new Date("2026-10-10T12:00:00-03:00").getTime();

/** Devuelve el porcentaje (0-100) de avance entre el inicio y el final del
 *  período. Si todavía no arrancó deja un mínimo visible para que la barra no
 *  se vea vacía; si ya pasó la fecha, queda al 100%. */
function computeProgressPct(nowMs: number): number {
  const total = PROGRESS_END_MS - PROGRESS_START_MS;
  if (total <= 0) return 100;
  const ratio = (nowMs - PROGRESS_START_MS) / total;
  if (ratio <= 0) return 1.2;
  if (ratio >= 1) return 100;
  return Math.max(1.2, ratio * 100);
}

function PawIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" aria-hidden {...props}>
      <ellipse cx="50" cy="68" rx="24" ry="22" />
      <ellipse cx="18" cy="40" rx="10" ry="14" />
      <ellipse cx="82" cy="40" rx="10" ry="14" />
      <ellipse cx="34" cy="20" rx="9" ry="13" />
      <ellipse cx="66" cy="20" rx="9" ry="13" />
    </svg>
  );
}

type PawDecoration = {
  id: number;
  top: string;
  left: string;
  size: number;
  rotate: number;
  opacity: number;
  delay: string;
  duration: string;
  color: "orange" | "cream";
};

const BACKGROUND_PAWS: PawDecoration[] = [
  { id: 1, top: "6%",  left: "5%",  size: 78,  rotate: -18, opacity: 0.16, delay: "0s",    duration: "9s",  color: "orange" },
  { id: 2, top: "16%", left: "82%", size: 104, rotate: 22,  opacity: 0.12, delay: "1.2s",  duration: "11s", color: "cream"  },
  { id: 3, top: "68%", left: "3%",  size: 124, rotate: 14,  opacity: 0.13, delay: "0.6s",  duration: "12s", color: "cream"  },
  { id: 4, top: "76%", left: "80%", size: 88,  rotate: -10, opacity: 0.15, delay: "2.1s",  duration: "10s", color: "orange" },
  { id: 5, top: "40%", left: "92%", size: 58,  rotate: 35,  opacity: 0.10, delay: "1.8s",  duration: "8s",  color: "orange" },
  { id: 6, top: "54%", left: "47%", size: 58,  rotate: -4,  opacity: 0.06, delay: "2.6s",  duration: "13s", color: "cream"  },
  { id: 7, top: "30%", left: "38%", size: 46,  rotate: 18,  opacity: 0.08, delay: "0.9s",  duration: "11s", color: "orange" },
  { id: 8, top: "88%", left: "44%", size: 52,  rotate: -22, opacity: 0.09, delay: "1.5s",  duration: "10s", color: "orange" },
];

export default function ComingSoonPage() {
  const [progress, setProgress] = useState(() => computeProgressPct(Date.now()));

  /** Refrescamos cada 30 segundos. Es más que suficiente para una barra cuyo
   *  período total se mide en meses y mantiene la sensación de "vivo" para
   *  quien deje la pestaña abierta un rato. */
  useEffect(() => {
    const tick = () => setProgress(computeProgressPct(Date.now()));
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative isolate flex min-h-dvh min-h-screen w-full overflow-hidden font-display text-black">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 18% 12%, rgba(254,134,39,0.22), transparent 55%), radial-gradient(circle at 84% 88%, rgba(255,215,146,0.65), transparent 60%), linear-gradient(180deg, #fff8ee 0%, #fff1dc 55%, #ffe5bd 100%)",
        }}
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        aria-hidden
      >
        {BACKGROUND_PAWS.map((p) => (
          <PawIcon
            key={p.id}
            className={`coming-paw absolute ${
              p.color === "orange" ? "text-mascoteada-orange" : "text-mascoteada-cream"
            }`}
            style={{
              top: p.top,
              left: p.left,
              width: p.size,
              height: p.size,
              opacity: p.opacity,
              animationDelay: p.delay,
              animationDuration: p.duration,
              "--paw-rotate": `${p.rotate}deg`,
            } as CSSProperties}
          />
        ))}
      </div>

      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-12 sm:px-10">
        <img
          src={ANIMAL_LOGO_SRC}
          alt="Animal World"
          className="coming-logo h-auto w-full max-w-[16rem] object-contain sm:max-w-sm md:max-w-md"
          decoding="async"
        />

        <p className="coming-fade-in mt-10 flex items-center justify-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.34em] text-mascoteada-orange sm:text-xs">
          <span className="inline-block h-px w-7 bg-mascoteada-orange/40" aria-hidden />
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-mascoteada-orange" aria-hidden />
          <span>Próximamente</span>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-mascoteada-orange" aria-hidden />
          <span className="inline-block h-px w-7 bg-mascoteada-orange/40" aria-hidden />
        </p>

        <h1
          className="coming-fade-in mt-4 text-balance text-center text-[1.75rem] font-bold leading-[1.1] text-black sm:text-4xl md:text-[2.75rem]"
          style={{ animationDelay: "80ms" } as CSSProperties}
        >
          Estamos trabajando para encontrarnos nuevamente
        </h1>

        <p
          className="coming-fade-in mt-5 max-w-xl text-balance text-center text-base leading-relaxed text-black/70 sm:text-lg"
          style={{ animationDelay: "180ms" } as CSSProperties}
        >
          Estamos preparando algo muy especial para vos y tu mascota. Volvemos
          pronto con más alegría, más premios y más amor por los animales.
        </p>

        <div
          className="coming-fade-in mt-12 w-full max-w-xl"
          style={{ animationDelay: "280ms" } as CSSProperties}
        >
          <div
            role="progressbar"
            aria-label="Cargando próxima edición de Animal World"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            className="relative h-5 w-full overflow-hidden rounded-full bg-white shadow-[inset_0_2px_6px_rgba(0,0,0,0.08)] ring-1 ring-black/5 sm:h-6"
          >
            <div
              className="coming-progress-fill absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-black/55">
            <span
              className="coming-dot inline-block h-1.5 w-1.5 rounded-full bg-mascoteada-orange"
              style={{ animationDelay: "0ms" } as CSSProperties}
              aria-hidden
            />
            <span
              className="coming-dot inline-block h-1.5 w-1.5 rounded-full bg-mascoteada-orange"
              style={{ animationDelay: "180ms" } as CSSProperties}
              aria-hidden
            />
            <span
              className="coming-dot inline-block h-1.5 w-1.5 rounded-full bg-mascoteada-orange"
              style={{ animationDelay: "360ms" } as CSSProperties}
              aria-hidden
            />
            <span className="ml-2 font-medium tracking-wide">
              Cargando una nueva edición
            </span>
          </div>
        </div>
      </main>

      <footer className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-2 text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-black/45">
        <span>Animal World · Posadas, Misiones</span>
      </footer>
    </div>
  );
}
