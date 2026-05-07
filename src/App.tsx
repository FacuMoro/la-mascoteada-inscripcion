import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "./lib/supabase";
import {
  AUSPICIAN_LOGO_FILES,
  INVITAN_ROW_BOTTOM,
  INVITAN_ROW_TOP,
  ORGANIZA_LOGO_FILES,
  sponsorLogoSrc,
} from "./sponsors";

type FormState = {
  nombre: string;
  apellido: string;
  dni: string;
  mail: string;
  telefono: string;
  cuantas_mascotas: number;
  nombres_mascotas: string[];
  aceptaTerminos: boolean;
};

/** PostgREST a veces pone el texto en `details`; el code no siempre llega como 23505 en el cliente. */
function isDniUniqueViolation(error: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}): boolean {
  if (String(error.code) === "23505") return true;
  const blob = [error.message, error.details, error.hint]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    blob.includes("duplicate key") ||
    blob.includes("unique constraint") ||
    blob.includes("usuarios_mascoteada_dni")
  );
}

const initialForm: FormState = {
  nombre: "",
  apellido: "",
  dni: "",
  mail: "",
  telefono: "",
  cuantas_mascotas: 1,
  nombres_mascotas: [""],
  aceptaTerminos: false,
};

const LOGO_PRINCIPAL_SRC = encodeURI("/Logo Mascoteada.png");

const TERMS_SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Responsable y organización",
    body: "El evento es organizado por Grupo Animal SRL junto a las empresas que auspician y acompañan la propuesta. A los fines de la Ley 25.326 de Protección de Datos Personales, el responsable del tratamiento de datos es Grupo Animal SRL, con domicilio en Av. Francisco de Haro 4505, Posadas, Misiones, República Argentina. Para cualquier consulta o reclamo vinculado a tus datos podés escribirnos a contacto@animalworldveterinaria.com.ar. La inscripción al evento es voluntaria, gratuita y se realiza únicamente a través del formulario disponible en este sitio.",
  },
  {
    title: "2. Inscripción y sorteos",
    body: "El formulario tiene como finalidad principal registrar a las personas que participan de los sorteos y premios que se realizarán durante el evento. La inscripción no garantiza el otorgamiento de premio alguno; los ganadores serán seleccionados al azar entre las personas inscriptas.",
  },
  {
    title: "3. Entrega de premios",
    body: "Los premios se entregan únicamente al ganador presente en el evento, en el momento del sorteo. Si la persona ganadora no se encontrara presente al ser anunciada, se seleccionará otro ganador en su reemplazo. Grupo Animal SRL no realizará envíos ni asumirá ningún gasto de retiro, traslado o entrega de los premios fuera del lugar y horario del evento.",
  },
  {
    title: "4. Datos personales y finalidades",
    body: "Al completar el formulario, el participante presta su consentimiento libre, expreso e informado para que Grupo Animal SRL trate sus datos personales (nombre, apellido, DNI, mail, teléfono y datos de su mascota) con las siguientes finalidades: (a) gestionar la inscripción al evento, (b) validar la identidad de los participantes y de los eventuales ganadores, (c) contactar al participante en caso de resultar premiado y (d) realizar acciones de comunicación y marketing posteriores por parte de Grupo Animal SRL relacionadas con sus servicios y eventos (por ejemplo, novedades, promociones o futuras ediciones). El participante podrá oponerse en cualquier momento al uso de sus datos con fines de marketing escribiendo a contacto@animalworldveterinaria.com.ar, sin que ello afecte su inscripción al evento.",
  },
  {
    title: "5. Conservación, seguridad y derechos",
    body: "Los datos se conservarán por el tiempo necesario para cumplir con las finalidades antes descriptas y con las obligaciones legales aplicables. Se aplican medidas razonables de seguridad para proteger la información. El titular de los datos puede ejercer en cualquier momento sus derechos de acceso, rectificación, actualización y supresión, de conformidad con la Ley 25.326, escribiendo a contacto@animalworldveterinaria.com.ar. La autoridad de aplicación en Argentina es la Agencia de Acceso a la Información Pública (AAIP), ante la cual el titular tiene derecho a presentar reclamos.",
  },
  {
    title: "6. Proveedores y almacenamiento",
    body: "Para la prestación del servicio de inscripción se utilizan proveedores tecnológicos de terceros. En particular, los datos cargados a través de este formulario se almacenan en la plataforma Supabase (servicio gestionado de base de datos), que actúa como encargado de tratamiento por cuenta de Grupo Animal SRL. Esto puede implicar el almacenamiento o procesamiento de los datos en servidores ubicados fuera de la República Argentina; en tales casos, Grupo Animal SRL adopta los recaudos razonables para que el tratamiento se realice con un nivel adecuado de protección y de acuerdo con la normativa argentina aplicable.",
  },
  {
    title: "7. Cesión a terceros",
    body: "Los datos personales no serán cedidos a terceros ajenos al evento sin consentimiento previo del titular, salvo cuando dicha comunicación resulte necesaria para cumplir con los fines de la inscripción, con obligaciones legales o ante requerimientos de autoridades competentes.",
  },
  {
    title: "8. Menores de edad",
    body: "La inscripción está dirigida a personas mayores de 18 años. Los menores de edad podrán asistir al evento con sus mascotas siempre acompañados por su madre, padre, tutor o adulto responsable. La inscripción del menor en el sorteo solo puede realizarla su madre, padre, tutor o representante legal, completando el formulario con sus propios datos y prestando consentimiento expreso por el menor. Al hacerlo, el adulto responsable declara contar con autorización suficiente y se hace responsable por la información proporcionada y por el cuidado del menor y la mascota durante el evento. En caso de detectarse que un menor de edad se inscribió por sí mismo sin intervención de un adulto responsable, Grupo Animal SRL podrá eliminar dicho registro y excluirlo de los sorteos.",
  },
  {
    title: "9. Asistencia con mascotas",
    body: "Las mascotas son responsabilidad exclusiva de su dueño, tutor o adulto responsable. Deben asistir con collar, correa o medio de sujeción adecuado y, en lo posible, con su esquema de vacunación al día. La organización podrá solicitar el retiro del predio de aquellas mascotas que muestren un comportamiento agresivo o que pongan en riesgo a otras personas o animales.",
  },
  {
    title: "10. Conducta y seguridad",
    body: "Quien participe del evento se compromete a seguir las indicaciones del personal de la organización y a respetar las normas de convivencia y seguridad del predio. La organización se reserva el derecho de admisión y permanencia.",
  },
  {
    title: "11. Imagen y registro audiovisual",
    body: "Durante el evento podrán tomarse fotografías y videos. Al asistir, el participante autoriza el uso no comercial de dicho material en redes sociales y comunicaciones del evento, salvo que manifieste expresamente su negativa al personal de la organización. En el caso de imágenes en las que aparezcan menores de edad, el adulto responsable podrá solicitar en cualquier momento que se retiren del material difundido.",
  },
  {
    title: "12. Modificaciones y fuerza mayor",
    body: "La organización podrá modificar el cronograma, los premios o cualquier aspecto del evento por razones operativas o de fuerza mayor (incluidas condiciones climáticas), informando por sus canales habituales.",
  },
  {
    title: "13. Aceptación",
    body: "La marcación del casillero «Acepto los términos y condiciones» implica el conocimiento y la aceptación íntegra de las presentes condiciones por parte del participante o, en su caso, del adulto responsable que inscribe al menor.",
  },
];

/** Forma orgánica tipo sitio principal: ~50% naranja, borde crema ~20% como acento. */
function HeroBlob() {
  return (
    <svg
      className="pointer-events-none absolute top-[-5%] right-[-8%] h-[clamp(420px,92vh,920px)] w-[clamp(320px,58vw,820px)] text-mascoteada-orange max-lg:hidden"
      viewBox="0 0 640 900"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M180 24c160-48 340 32 420 180 96 180 72 420-84 556-96 84-228 124-360 88C40 784-28 600 12 400 40 240 88 56 180 24z"
        fill="currentColor"
        stroke="#FFD792"
        strokeWidth="5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const infoCards = [
  {
    title: "Evento gratuito",
    text: "La entrada es libre para toda la familia. Vení a pasarla bien con nosotros.",
  },
  {
    title: "Ubicación",
    text: "Espacio María Morínigo, costanera de Posadas.",
  },
  {
    title: "Día y horario",
    text: "10 de mayo, desde las 15:30 hs.",
  },
  {
    title: "Premios",
    text: "Registrate en el formulario y participá por sorteos e increíbles premios.",
  },
];

function InfoCardsGrid() {
  return (
    <div className="grid w-full max-w-full grid-cols-2 gap-3.5 sm:gap-4 lg:max-w-[64rem] xl:max-w-[72rem]">
      {infoCards.map((card) => (
        <div
          key={card.title}
          className="flex min-h-0 items-start gap-3 rounded-2xl bg-black px-3.5 py-3.5 text-left text-white sm:gap-3.5 sm:px-4 sm:py-4 lg:px-4 lg:py-4.5"
        >
          <span
            className="mt-0.5 h-9 w-1 shrink-0 rounded-full bg-mascoteada-orange sm:h-10 lg:h-11"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-base font-semibold leading-snug sm:text-[1.0625rem] lg:text-lg">
              {card.title}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-white/75 sm:text-[0.9375rem] lg:text-base">
              {card.text}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

const CONFETTI_COLORS = [
  "#fe8627",
  "#ffd792",
  "#000000",
  "#ffffff",
  "#fb923c",
  "#fde68a",
];

const CONFETTI_SHAPES: Array<"square" | "rect" | "circle"> = [
  "square",
  "rect",
  "rect",
  "circle",
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
  shape: "square" | "rect" | "circle";
  rotateStart: number;
};

type SparkPiece = {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
};

function buildConfetti(count: number): ConfettiPiece[] {
  const pieces: ConfettiPiece[] = [];
  for (let i = 0; i < count; i++) {
    pieces.push({
      id: i,
      left: Math.random() * 100,
      size: 6 + Math.round(Math.random() * 10),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay: Math.random() * 0.6,
      duration: 2.6 + Math.random() * 2.2,
      drift: Math.round((Math.random() - 0.5) * 240),
      rotate: 360 + Math.round(Math.random() * 720),
      shape: CONFETTI_SHAPES[i % CONFETTI_SHAPES.length],
      rotateStart: Math.round(Math.random() * 180),
    });
  }
  return pieces;
}

function buildSparks(count: number): SparkPiece[] {
  const sparks: SparkPiece[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const radius = 70 + Math.random() * 50;
    sparks.push({
      id: i,
      x: Math.round(Math.cos(angle) * radius),
      y: Math.round(Math.sin(angle) * radius),
      size: 8 + Math.round(Math.random() * 6),
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    });
  }
  return sparks;
}

function CelebrationOverlay({ onClose }: { onClose: () => void }) {
  const confetti = useMemo(() => buildConfetti(72), []);
  const sparks = useMemo(() => buildSparks(14), []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-black/55 px-5 py-8"
    >
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      >
        {confetti.map((p) => (
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

      <div className="celebration-card relative w-full max-w-md rounded-3xl bg-white px-6 py-8 text-center shadow-2xl sm:px-9 sm:py-10">
        <div className="pointer-events-none absolute left-1/2 top-10 -translate-x-1/2" aria-hidden>
          {sparks.map((s) => (
            <span
              key={s.id}
              className="celebration-spark absolute block rounded-full"
              style={{
                width: s.size,
                height: s.size,
                backgroundColor: s.color,
                left: 0,
                top: 0,
                "--burst-x": `${s.x}px`,
                "--burst-y": `${s.y}px`,
              } as CSSProperties}
            />
          ))}
        </div>

        <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
          <span
            className="celebration-badge absolute inset-0 rounded-full bg-mascoteada-orange"
            aria-hidden
          />
          <svg
            viewBox="0 0 48 48"
            className="relative h-12 w-12 text-white"
            fill="none"
            aria-hidden
          >
            <path
              d="M14 24.5l7 7 13-15"
              stroke="currentColor"
              strokeWidth="4.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p className="mt-5 text-xs font-bold uppercase tracking-[0.32em] text-mascoteada-orange">
          ¡Inscripción exitosa!
        </p>
        <h2
          id="celebration-title"
          className="mt-2 text-3xl font-bold leading-tight text-black sm:text-[2rem]"
        >
          ¡Estás dentro!
        </h2>
        <p className="mt-3 text-base leading-relaxed text-black/70">
          Recibimos tu registro para{" "}
          <span className="font-semibold text-black">La Mascoteada</span>. Te
          esperamos el <span className="font-semibold">10 de mayo</span> desde
          las 15:30 hs en el Espacio María Morínigo, costanera de Posadas.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-black/55">
          Tu DNI ya está cargado para participar de los sorteos. ¡Nos vemos en
          el evento!
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-black px-6 py-3 text-base font-semibold text-white transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-mascoteada-orange/50"
        >
          ¡Genial!
        </button>
      </div>
    </div>
  );
}

function App() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [showTerms, setShowTerms] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const modalOpen = showTerms || showCelebration;
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showTerms) setShowTerms(false);
        if (showCelebration) setShowCelebration(false);
      }
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [modalOpen, showTerms, showCelebration]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);

    if (!supabase) {
      setFeedback({
        kind: "error",
        message:
          "Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Cloudflare Pages (Variables de entorno) y volver a desplegar.",
      });
      return;
    }

    const nombre = form.nombre.trim();
    const apellido = form.apellido.trim();
    const dni = form.dni.trim();
    const mail = form.mail.trim();
    const telefono = form.telefono.trim();
    const n = form.cuantas_mascotas;
    const nombresOk =
      form.nombres_mascotas.length >= n &&
      form.nombres_mascotas
        .slice(0, n)
        .every((s) => s.trim().length > 0);
    const nombres_mascotas = form.nombres_mascotas
      .slice(0, n)
      .map((s) => s.trim())
      .join(", ");

    if (!nombre || !apellido || !dni || !mail || !telefono) {
      setFeedback({
        kind: "error",
        message: "Completá nombre, apellido, DNI, mail y teléfono.",
      });
      return;
    }

    if (!form.aceptaTerminos) {
      setFeedback({
        kind: "error",
        message: "Tenés que aceptar los términos y condiciones para continuar.",
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setFeedback({ kind: "error", message: "Ingresá un mail válido." });
      return;
    }

    if (n < 1 || !Number.isFinite(form.cuantas_mascotas)) {
      setFeedback({
        kind: "error",
        message: "Registrá al menos una mascota.",
      });
      return;
    }

    if (!nombresOk) {
      setFeedback({
        kind: "error",
        message: "Indicá el nombre de cada mascota.",
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("usuarios_mascoteada").insert({
      nombre,
      apellido,
      dni,
      mail,
      telefono,
      cuantas_mascotas: form.cuantas_mascotas,
      nombres_mascotas,
    });
    setSubmitting(false);

    if (error) {
      const msgUsuario =
        "Este DNI ya está registrado. Te esperamos en el evento!";
      setFeedback({
        kind: "error",
        message: isDniUniqueViolation(error)
          ? msgUsuario
          : error.message || "No se pudo guardar la inscripción.",
      });
      return;
    }

    setForm(initialForm);
    setFeedback(null);
    setShowCelebration(true);
  }

  const inputClass =
    "mt-1.5 box-border min-h-11 w-full min-w-0 touch-manipulation rounded-2xl border border-black/10 bg-neutral-50 px-4 py-3 font-display font-normal text-base leading-normal text-black shadow-inner shadow-black/5 placeholder:text-black/35 outline-none transition focus:border-mascoteada-orange focus:bg-white focus:ring-2 focus:ring-mascoteada-orange/35";

  const labelClass = "block min-w-0 text-left text-sm font-semibold text-black";

  function altFromLogoFile(file: string): string {
    return file.replace(/^Logo\s+/i, "").replace(/\.[^.]+$/, "");
  }

  function SponsorGrid({
    files,
    namePrefix,
    centered = false,
    listClassName = "",
    suppressTopMargin = false,
  }: {
    files: readonly string[];
    namePrefix: string;
    centered?: boolean;
    listClassName?: string;
    suppressTopMargin?: boolean;
  }) {
    if (files.length === 0) return null;
    const single = files.length === 1;
    const uniformCentered = centered && !single;
    const listLayout = single
      ? "flex justify-center"
      : centered
        ? uniformCentered && files.length === 2
          ? "flex flex-wrap justify-center gap-3 xl:flex-nowrap xl:gap-5"
          : "flex flex-wrap justify-center gap-3 sm:gap-5"
        : "grid grid-cols-2 gap-3 sm:grid-cols-3";
    return (
      <ul
        className={`${suppressTopMargin ? "" : "mt-5 "} ${listLayout} ${listClassName}`.trim()}
      >
        {files.map((file) => (
          <li
            key={file}
            className={
              single
                ? "flex w-full max-w-[240px] items-center justify-center rounded-xl border border-black/10 bg-white px-6 py-5 shadow-sm"
                : uniformCentered
                  ? "flex h-24 w-[9.5rem] shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white px-3 py-3 shadow-sm sm:h-28 sm:w-44"
                  : "flex items-center justify-center rounded-xl border border-black/10 bg-white px-3 py-4 shadow-sm"
            }
          >
            <img
              src={sponsorLogoSrc(file)}
              alt={`${namePrefix} ${altFromLogoFile(file)}`}
              className={
                single
                  ? "h-auto max-h-20 w-full object-contain"
                  : uniformCentered
                    ? "max-h-full max-w-full object-contain"
                    : "max-h-12 w-full max-w-[140px] object-contain"
              }
              loading="lazy"
            />
          </li>
        ))}
      </ul>
    );
  }

  function InvitanPyramid() {
    const invitan = [...INVITAN_ROW_TOP, ...INVITAN_ROW_BOTTOM];
    const tileClass =
      "flex h-20 w-full items-center justify-center rounded-xl border border-black/10 bg-white px-2 py-2 shadow-sm sm:h-24 sm:px-3 sm:py-3";

    return (
      <ul className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-3.5">
        {invitan.map((file) => (
          <li key={file} className={tileClass}>
            <img
              src={sponsorLogoSrc(file)}
              alt={`Invita ${altFromLogoFile(file)}`}
              className="max-h-full max-w-full object-contain"
              loading="lazy"
            />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="min-h-dvh min-h-screen bg-white font-display text-black">
      <div className="relative overflow-hidden">
        <HeroBlob />

        {/* Franja naranja móvil (~proporción visual del hero en desktop) */}
        <div
          className="h-3 w-full bg-mascoteada-orange lg:hidden"
          style={{ boxShadow: "inset 0 -2px 0 #FFD792" }}
          aria-hidden
        />

        <main className="relative z-10 mx-auto max-w-7xl min-w-0 px-5 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] pt-[max(2.5rem,calc(env(safe-area-inset-top,0px)+1.25rem))] sm:px-8 sm:pt-14 lg:grid lg:min-h-[calc(100svh-8rem)] lg:grid-cols-[1fr_minmax(0,0.95fr)] lg:items-start lg:gap-x-12 lg:pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pt-12">
          <div className="max-w-2xl min-w-0 lg:col-span-2 lg:pt-4">
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-mascoteada-orange">
              Inscripción 2026
            </p>
            <h1 className="mt-5 min-w-0 max-w-full">
              <img
                src={LOGO_PRINCIPAL_SRC}
                alt="La Mascoteada"
                className="h-auto w-full max-w-[min(100%,576px)] object-contain object-left sm:max-w-[640px]"
                decoding="async"
              />
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-black/70 sm:text-lg">
              Completá el formulario para participar de los premios y regalos.
              No es necesaria la inscripción para asistir al evento.
            </p>
          </div>

          <div className="mt-10 min-w-0 lg:col-span-2 lg:grid lg:grid-cols-[minmax(min(100%,calc((42rem+3cm)*0.6)),1fr)_auto] lg:items-start lg:gap-x-10 xl:grid-cols-[minmax(min(100%,calc((48rem+3cm)*0.6)),1fr)_auto] xl:gap-x-12">
            <div className="mx-auto w-full max-w-[calc((42rem+3cm)*0.6)] rounded-[2rem] border border-black/8 bg-white/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)] sm:p-8 lg:mx-0 lg:p-8 lg:justify-self-stretch xl:max-w-[calc((48rem+3cm)*0.6)]">
              <form onSubmit={onSubmit} className="min-w-0 max-w-full">
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <label className={labelClass}>
                    Nombre
                    <input
                      required
                      name="nombre"
                      autoComplete="given-name"
                      value={form.nombre}
                      onChange={(e) => update("nombre", e.target.value)}
                      className={inputClass}
                      placeholder="Nombre"
                    />
                  </label>
                  <label className={labelClass}>
                    Apellido
                    <input
                      required
                      name="apellido"
                      autoComplete="family-name"
                      value={form.apellido}
                      onChange={(e) => update("apellido", e.target.value)}
                      className={inputClass}
                      placeholder="Apellido"
                    />
                  </label>
                </div>

                <div className="mt-4 min-w-0 space-y-4">
                  <label className={`${labelClass} block`}>
                    DNI
                    <input
                      required
                      name="dni"
                      inputMode="numeric"
                      autoComplete="off"
                      value={form.dni}
                      onChange={(e) => update("dni", e.target.value)}
                      className={inputClass}
                      placeholder="Sin puntos"
                    />
                  </label>

                  <label className={`${labelClass} block`}>
                    Mail
                    <input
                      required
                      type="email"
                      name="mail"
                      autoComplete="email"
                      value={form.mail}
                      onChange={(e) => update("mail", e.target.value)}
                      className={inputClass}
                      placeholder="correo@ejemplo.com"
                    />
                  </label>

                  <label className={`${labelClass} block`}>
                    Teléfono
                    <input
                      required
                      type="tel"
                      name="telefono"
                      autoComplete="tel"
                      value={form.telefono}
                      onChange={(e) => update("telefono", e.target.value)}
                      className={inputClass}
                      placeholder="Código de área sin 0 + número sin 15"
                    />
                  </label>

                  <label className={`${labelClass} block`}>
                    ¿Cuántas mascotas traés?
                    <input
                      required
                      type="number"
                      name="cuantas_mascotas"
                      min={1}
                      step={1}
                      value={
                        Number.isNaN(form.cuantas_mascotas)
                          ? ""
                          : form.cuantas_mascotas
                      }
                      onChange={(e) => {
                        const raw = parseInt(e.target.value, 10);
                        const nextN =
                          Number.isNaN(raw) || raw < 1 ? 1 : raw;
                        setForm((prev) => {
                          const names = [...prev.nombres_mascotas];
                          while (names.length < nextN) names.push("");
                          if (names.length > nextN)
                            names.length = nextN;
                          return {
                            ...prev,
                            cuantas_mascotas: nextN,
                            nombres_mascotas: names,
                          };
                        });
                      }}
                      className={inputClass}
                    />
                  </label>

                  <div className="space-y-3">
                    <p className={`${labelClass} !mb-0`}>
                      Nombre de cada mascota
                    </p>
                    {Array.from(
                      { length: form.cuantas_mascotas },
                      (_, i) => (
                        <input
                          key={i}
                          required
                          name={`nombre_mascota_${i + 1}`}
                          autoComplete="off"
                          aria-label="Nombre mascota"
                          value={form.nombres_mascotas[i] ?? ""}
                          onChange={(e) => {
                            const v = e.target.value;
                            setForm((prev) => {
                              const next = [...prev.nombres_mascotas];
                              next[i] = v;
                              return {
                                ...prev,
                                nombres_mascotas: next,
                              };
                            });
                          }}
                          className={`${inputClass} !mt-0`}
                          placeholder="Nombre mascota"
                        />
                      ),
                    )}
                  </div>

                  <label className="mt-6 flex cursor-pointer items-start gap-3 text-left">
                    <input
                      type="checkbox"
                      name="acepta_terminos"
                      required
                      checked={form.aceptaTerminos}
                      onChange={(e) =>
                        update("aceptaTerminos", e.target.checked)
                      }
                      className="mt-1 h-4 w-4 shrink-0 rounded border-black/25 text-mascoteada-orange focus:ring-2 focus:ring-mascoteada-orange/40"
                    />
                    <span className="text-sm font-normal leading-snug text-black">
                      Acepto los{" "}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setShowTerms(true);
                        }}
                        className="cursor-pointer font-semibold text-mascoteada-orange underline-offset-2 hover:underline focus:underline focus:outline-none"
                      >
                        términos y condiciones
                      </button>{" "}
                      del evento.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="mt-8 min-h-11 w-full touch-manipulation rounded-2xl bg-mascoteada-orange px-4 py-3 text-base font-semibold leading-normal text-white shadow-md shadow-mascoteada-orange/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-12 sm:py-4"
                  >
                    {submitting ? "Enviando…" : "Enviar inscripción"}
                  </button>

                  {feedback && feedback.kind === "error" ? (
                    <p
                      role="status"
                      className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
                    >
                      {feedback.message}
                    </p>
                  ) : null}

                  <div className="mt-10 max-w-full space-y-10 rounded-2xl border border-black/8 bg-white px-4 py-6 shadow-[0_8px_40px_rgba(0,0,0,0.04)] sm:px-6">
                    <div>
                      <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-black/70">
                        Organiza
                      </p>
                      <SponsorGrid
                        files={ORGANIZA_LOGO_FILES}
                        namePrefix="Organiza"
                      />
                    </div>
                    <div className="border-t border-black/10 pt-10">
                      <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-black/70">
                        Auspician
                      </p>
                      <SponsorGrid
                        files={AUSPICIAN_LOGO_FILES}
                        namePrefix="Auspicia"
                        centered
                        suppressTopMargin
                        listClassName="mt-4"
                      />
                    </div>
                    <div className="border-t border-black/10 pt-10">
                      <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-black/70">
                        Invitan
                      </p>
                      <InvitanPyramid />
                    </div>
                  </div>
                </div>
              </form>
            </div>

            <aside className="relative z-10 hidden min-w-0 lg:block lg:w-full lg:max-w-[min(100%,64rem)] lg:pt-28 lg:pl-2 xl:max-w-[72rem]">
              <InfoCardsGrid />
            </aside>
          </div>

          <p className="mx-auto mt-10 max-w-xl text-center text-sm text-black/50 lg:col-span-2 lg:mx-0 lg:text-left">
            ¿Problemas con el formulario? Revisá la conexión o contactá a la
            organización del evento.
          </p>

          <div className="mt-10 lg:col-span-2 lg:hidden">
            <InfoCardsGrid />
          </div>
        </main>
      </div>

      {showCelebration ? <CelebrationOverlay onClose={() => setShowCelebration(false)} /> : null}

      {showTerms ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="terms-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowTerms(false);
          }}
        >
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4 border-b border-black/10 px-5 py-4 sm:px-7 sm:py-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-mascoteada-orange">
                  La Mascoteada
                </p>
                <h2
                  id="terms-title"
                  className="mt-1 text-lg font-semibold text-black sm:text-xl"
                >
                  Términos y Condiciones
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowTerms(false)}
                aria-label="Cerrar términos y condiciones"
                className="-mr-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-black/60 transition hover:bg-black/5 hover:text-black focus:outline-none focus:ring-2 focus:ring-mascoteada-orange/40"
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              <p className="text-sm leading-relaxed text-black/70">
                Al inscribirte y participar de La Mascoteada, aceptás las
                siguientes condiciones:
              </p>
              <div className="mt-5 space-y-5">
                {TERMS_SECTIONS.map((s) => (
                  <section key={s.title}>
                    <h3 className="text-sm font-semibold text-black sm:text-base">
                      {s.title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-black/75">
                      {s.body}
                    </p>
                  </section>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-black/10 bg-neutral-50 px-5 py-4 sm:px-7">
              <button
                type="button"
                onClick={() => setShowTerms(false)}
                className="min-h-11 rounded-2xl bg-mascoteada-orange px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-mascoteada-orange/25 transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-mascoteada-orange/40"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
