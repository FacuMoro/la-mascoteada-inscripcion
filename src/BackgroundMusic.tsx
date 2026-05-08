import { useCallback, useEffect, useRef, useState } from "react";

const AUDIO_SRC = "/animal-rock.mp3";
const MUTED_PREF_KEY = "mascoteada:bg-music-muted-v2";

/** Música de fondo del sitio.
 *
 *  Estrategia para sortear la política de autoplay de los navegadores: la pista
 *  arranca reproduciéndose en silencio (audio.muted=true) ni bien carga la
 *  página, lo cual sí está permitido sin gesto del usuario. Apenas el visitante
 *  hace el primer gesto sobre la página (tap, click, tecla, scroll, mover el
 *  mouse o el dedo), se desmutea automáticamente y suena el jingle.
 *
 *  El botón flotante refleja el estado audible y permite silenciar/reactivar.
 *  La preferencia explícita de silencio se persiste en localStorage. */
export default function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [userMuted, setUserMuted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(MUTED_PREF_KEY) === "1";
  });
  const [audible, setAudible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(MUTED_PREF_KEY, userMuted ? "1" : "0");
  }, [userMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = 0.45;
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (userMuted) {
      audio.pause();
      audio.muted = true;
      setAudible(false);
      return;
    }

    audio.muted = true;
    audio.play().catch(() => {
      // Hasta el primer gesto válido, los navegadores rechazan incluso
      // play() muteado. Cae al listener de abajo.
    });

    // Sólo eventos que el navegador trata como "user activation".
    // scroll/wheel/mousemove/touchmove NO cuentan a los fines de la
    // política de autoplay y no permiten arrancar la reproducción.
    const events: Array<keyof WindowEventMap> = [
      "pointerdown",
      "touchstart",
      "click",
      "keydown",
    ];

    const onActivation = () => {
      audio.muted = false;
      audio
        .play()
        .then(() => {
          cleanup();
          setAudible(true);
        })
        .catch(() => {
          // Si por alguna razón rechazó, dejamos los listeners para
          // reintentar en el próximo gesto del usuario.
        });
    };

    const cleanup = () => {
      for (const ev of events) {
        window.removeEventListener(ev, onActivation, true);
      }
    };

    for (const ev of events) {
      window.addEventListener(ev, onActivation, {
        passive: true,
        capture: true,
      });
    }
    return cleanup;
  }, [userMuted]);

  const onClick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audible) {
      setUserMuted(true);
    } else {
      setUserMuted(false);
      audio.muted = false;
      audio.play().catch(() => {});
      setAudible(true);
    }
  }, [audible]);

  return (
    <>
      <audio
        ref={audioRef}
        src={AUDIO_SRC}
        loop
        preload="auto"
        playsInline
        aria-hidden
      />
      <button
        type="button"
        onClick={onClick}
        aria-label={audible ? "Silenciar música" : "Activar música"}
        title={audible ? "Silenciar música" : "Activar música"}
        className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-4 z-[80] inline-flex h-12 w-12 items-center justify-center rounded-full bg-mascoteada-orange text-white shadow-lg shadow-black/25 ring-2 ring-white transition hover:brightness-105 focus:outline-none focus:ring-2 focus:ring-mascoteada-orange/40 sm:h-14 sm:w-14"
      >
        {audible ? <SpeakerOnIcon /> : <SpeakerMutedIcon />}
      </button>
    </>
  );
}

function SpeakerOnIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6 sm:h-7 sm:w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}

function SpeakerMutedIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6 sm:h-7 sm:w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
      <path d="m16 9 5 6" />
      <path d="m21 9-5 6" />
    </svg>
  );
}
