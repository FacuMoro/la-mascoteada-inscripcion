import { type FormEvent, useState } from 'react'
import { supabase } from './lib/supabase'
import {
  AUSPICIAN_LOGO_FILES,
  INVITAN_ROW_BOTTOM,
  INVITAN_ROW_TOP,
  ORGANIZA_LOGO_FILES,
  sponsorLogoSrc,
} from './sponsors'

type FormState = {
  nombre: string
  apellido: string
  dni: string
  mail: string
  telefono: string
  cuantas_mascotas: number
  nombres_mascotas: string
}

/** PostgREST a veces pone el texto en `details`; el code no siempre llega como 23505 en el cliente. */
function isDniUniqueViolation(error: {
  code?: string
  message?: string
  details?: string
  hint?: string
}): boolean {
  if (String(error.code) === '23505') return true
  const blob = [error.message, error.details, error.hint].filter(Boolean).join(' ').toLowerCase()
  return (
    blob.includes('duplicate key') ||
    blob.includes('unique constraint') ||
    blob.includes('usuarios_mascoteada_dni')
  )
}

const initialForm: FormState = {
  nombre: '',
  apellido: '',
  dni: '',
  mail: '',
  telefono: '',
  cuantas_mascotas: 0,
  nombres_mascotas: '',
}

const LOGO_PRINCIPAL_SRC = encodeURI('/Logo Mascoteada.png')

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
  )
}

const infoCards = [
  { title: 'Inscripción segura', text: 'Tus datos se almacenan en base cifrada.' },
  { title: 'Confirmación', text: 'Te contactamos por mail con los detalles.' },
  { title: 'Traé a tus mascotas', text: 'Indicá cuántas vienen y sus nombres.' },
  { title: 'Evento 2026', text: 'La Mascoteada — un día para celebrar.' },
]

function InfoCardsGrid() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-3 lg:max-w-md xl:max-w-lg">
      {infoCards.map((card) => (
        <div
          key={card.title}
          className="flex min-h-0 items-start gap-2.5 rounded-2xl bg-black px-3 py-3 text-left text-white sm:gap-4 sm:px-4 sm:py-4"
        >
          <span
            className="mt-0.5 h-8 w-1 shrink-0 rounded-full bg-mascoteada-orange sm:h-10"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-snug sm:text-base">{card.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/75 sm:text-sm">
              {card.text}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function App() {
  const [form, setForm] = useState<FormState>(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<
    { kind: 'success' | 'error'; message: string } | null
  >(null)

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFeedback(null)

    if (!supabase) {
      setFeedback({
        kind: 'error',
        message:
          'Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en Cloudflare Pages (Variables de entorno) y volver a desplegar.',
      })
      return
    }

    const nombre = form.nombre.trim()
    const apellido = form.apellido.trim()
    const dni = form.dni.trim()
    const mail = form.mail.trim()
    const telefono = form.telefono.trim()
    const nombres_mascotas = form.nombres_mascotas.trim() || null

    if (!nombre || !apellido || !dni || !mail || !telefono) {
      setFeedback({
        kind: 'error',
        message: 'Completá nombre, apellido, DNI, mail y teléfono.',
      })
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      setFeedback({ kind: 'error', message: 'Ingresá un mail válido.' })
      return
    }

    if (form.cuantas_mascotas < 0 || !Number.isFinite(form.cuantas_mascotas)) {
      setFeedback({ kind: 'error', message: 'La cantidad de mascotas no es válida.' })
      return
    }

    setSubmitting(true)
    const { error } = await supabase.from('usuarios_mascoteada').insert({
      nombre,
      apellido,
      dni,
      mail,
      telefono,
      cuantas_mascotas: form.cuantas_mascotas,
      nombres_mascotas,
    })
    setSubmitting(false)

    if (error) {
      const msgUsuario =
        'Este DNI ya está registrado. Te esperamos en el evento!'
      setFeedback({
        kind: 'error',
        message: isDniUniqueViolation(error) ? msgUsuario : (error.message || 'No se pudo guardar la inscripción.'),
      })
      return
    }

    setForm(initialForm)
    setFeedback({
      kind: 'success',
      message: '¡Listo! Tu inscripción a La Mascoteada se registró correctamente.',
    })
  }

  const inputClass =
    'mt-1.5 box-border min-h-11 w-full min-w-0 touch-manipulation rounded-2xl border border-black/10 bg-neutral-50 px-4 py-3 text-base leading-normal text-black shadow-inner shadow-black/5 placeholder:text-black/35 outline-none transition focus:border-mascoteada-orange focus:bg-white focus:ring-2 focus:ring-mascoteada-orange/35'

  const textareaClass =
    'mt-1.5 box-border min-h-[5.5rem] w-full min-w-0 touch-manipulation rounded-2xl border border-black/10 bg-neutral-50 px-4 py-3 text-base leading-normal text-black shadow-inner shadow-black/5 placeholder:text-black/35 outline-none transition focus:border-mascoteada-orange focus:bg-white focus:ring-2 focus:ring-mascoteada-orange/35'

  const labelClass = 'block min-w-0 text-left text-sm font-semibold text-black'

  function altFromLogoFile(file: string): string {
    return file.replace(/^Logo\s+/i, '').replace(/\.[^.]+$/, '')
  }

  function SponsorGrid({
    files,
    namePrefix,
    centered = false,
    listClassName = '',
    suppressTopMargin = false,
  }: {
    files: readonly string[]
    namePrefix: string
    centered?: boolean
    listClassName?: string
    suppressTopMargin?: boolean
  }) {
    if (files.length === 0) return null
    const single = files.length === 1
    const uniformCentered = centered && !single
    const listLayout = single
      ? 'flex justify-center'
      : centered
        ? 'flex flex-wrap justify-center gap-3 sm:gap-5'
        : 'grid grid-cols-2 gap-3 sm:grid-cols-3'
    return (
      <ul className={`${suppressTopMargin ? '' : 'mt-5 '} ${listLayout} ${listClassName}`.trim()}>
        {files.map((file) => (
          <li
            key={file}
            className={
              single
                ? 'flex w-full max-w-[240px] items-center justify-center rounded-xl border border-black/10 bg-white px-6 py-5 shadow-sm'
                : uniformCentered
                  ? 'flex h-24 w-[9.5rem] shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white px-3 py-3 shadow-sm sm:h-28 sm:w-44'
                  : 'flex items-center justify-center rounded-xl border border-black/10 bg-white px-3 py-4 shadow-sm'
            }
          >
            <img
              src={sponsorLogoSrc(file)}
              alt={`${namePrefix} ${altFromLogoFile(file)}`}
              className={
                single
                  ? 'h-auto max-h-20 w-full object-contain'
                  : uniformCentered
                    ? 'max-h-full max-w-full object-contain'
                    : 'max-h-12 w-full max-w-[140px] object-contain'
              }
              loading="lazy"
            />
          </li>
        ))}
      </ul>
    )
  }

  function InvitanPyramid() {
    const tileTop =
      'flex h-24 w-[10rem] shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white px-3 py-3 shadow-sm sm:h-28 sm:w-[11.25rem]'
    const tileBottom =
      'flex h-[5.25rem] w-[6.85rem] shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white px-2 py-2 shadow-sm sm:h-24 sm:w-[7.85rem]'

    return (
      <div className="mt-5 flex flex-col items-center gap-3 sm:gap-4">
        <div className="flex w-full flex-wrap justify-center gap-3 sm:gap-5">
          {INVITAN_ROW_TOP.map((file) => (
            <div key={file} className={tileTop}>
              <img
                src={sponsorLogoSrc(file)}
                alt={`Invita ${altFromLogoFile(file)}`}
                className="max-h-full max-w-full object-contain"
                loading="lazy"
              />
            </div>
          ))}
        </div>
        <div className="flex w-full flex-wrap justify-center gap-2 sm:gap-3">
          {INVITAN_ROW_BOTTOM.map((file) => (
            <div key={file} className={tileBottom}>
              <img
                src={sponsorLogoSrc(file)}
                alt={`Invita ${altFromLogoFile(file)}`}
                className="max-h-full max-w-full object-contain"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh min-h-screen bg-white font-display text-black">
      <div className="relative overflow-hidden">
        <HeroBlob />

        {/* Franja naranja móvil (~proporción visual del hero en desktop) */}
        <div
          className="h-3 w-full bg-mascoteada-orange lg:hidden"
          style={{ boxShadow: 'inset 0 -2px 0 #FFD792' }}
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
              Completá el formulario para participar de los premios y regalos. No es necesaria la
              inscripción para asistir al evento.
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="mt-10 max-w-full rounded-[2rem] border border-black/8 bg-white/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.06)] sm:p-8 lg:col-span-2 lg:mt-10 lg:max-w-none lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-x-10 lg:gap-y-6 lg:p-8 xl:max-w-[52rem] xl:gap-x-12"
          >
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:col-span-2">
              <label className={labelClass}>
                Nombre
                <input
                  required
                  name="nombre"
                  autoComplete="given-name"
                  value={form.nombre}
                  onChange={(e) => update('nombre', e.target.value)}
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
                  onChange={(e) => update('apellido', e.target.value)}
                  className={inputClass}
                  placeholder="Apellido"
                />
              </label>
            </div>

            <div className="mt-4 min-w-0 space-y-4 lg:col-start-1 lg:row-start-2 lg:mt-0">
              <label className={`${labelClass} block`}>
                DNI
                <input
                  required
                  name="dni"
                  inputMode="numeric"
                  autoComplete="off"
                  value={form.dni}
                  onChange={(e) => update('dni', e.target.value)}
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
                  onChange={(e) => update('mail', e.target.value)}
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
                  onChange={(e) => update('telefono', e.target.value)}
                  className={inputClass}
                  placeholder="Código de área + número"
                />
              </label>

              <label className={`${labelClass} block`}>
                ¿Cuántas mascotas traés?
                <input
                  required
                  type="number"
                  name="cuantas_mascotas"
                  min={0}
                  step={1}
                  value={Number.isNaN(form.cuantas_mascotas) ? '' : form.cuantas_mascotas}
                  onChange={(e) =>
                    update('cuantas_mascotas', parseInt(e.target.value, 10) || 0)
                  }
                  className={inputClass}
                />
              </label>

              <label className={`${labelClass} block`}>
                Nombres de las mascotas
                <textarea
                  name="nombres_mascotas"
                  rows={3}
                  value={form.nombres_mascotas}
                  onChange={(e) => update('nombres_mascotas', e.target.value)}
                  className={textareaClass}
                  placeholder="Separá con comas si son varias: Firulais, Mimi…"
                />
              </label>

              <button
                type="submit"
                disabled={submitting}
                className="mt-8 min-h-11 w-full touch-manipulation rounded-2xl bg-mascoteada-orange px-4 py-3 text-base font-semibold leading-normal text-white shadow-md shadow-mascoteada-orange/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-12 sm:py-4"
              >
                {submitting ? 'Enviando…' : 'Enviar inscripción'}
              </button>

              {feedback ? (
                <p
                  role="status"
                  className={
                    feedback.kind === 'success'
                      ? 'mt-6 rounded-2xl border border-mascoteada-cream/80 bg-mascoteada-cream/25 px-4 py-3 text-sm text-black/85'
                      : 'mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900'
                  }
                >
                  {feedback.message}
                </p>
              ) : null}

              <div className="mt-10 max-w-full space-y-10 rounded-2xl border border-black/8 bg-white px-4 py-6 shadow-[0_8px_40px_rgba(0,0,0,0.04)] sm:px-6">
                <div>
                  <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-black/70">
                    Organiza
                  </p>
                  <SponsorGrid files={ORGANIZA_LOGO_FILES} namePrefix="Organiza" />
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

            <aside className="relative z-10 hidden min-w-0 lg:col-start-2 lg:row-start-2 lg:block lg:max-w-[min(100%,20rem)] lg:pl-2 lg:pt-1 xl:max-w-[22rem]">
              <InfoCardsGrid />
            </aside>
          </form>

          <p className="mx-auto mt-10 max-w-xl text-center text-sm text-black/50 lg:col-span-2 lg:mx-0 lg:text-left">
            ¿Problemas con el formulario? Revisá la conexión o contactá a la organización del
            evento.
          </p>

          <div className="mt-10 lg:col-span-2 lg:hidden">
            <InfoCardsGrid />
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
