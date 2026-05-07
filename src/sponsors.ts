/**
 * Logos en la raíz de `public/` (ej. `Logo Sieger.png`).
 * Organiza: Animal World. Auspician: Sieger y Purina. Invitan: el resto de marcas.
 */
export const ORGANIZA_LOGO_FILES: readonly string[] = ['Logo Animal.png']

export const AUSPICIAN_LOGO_FILES: readonly string[] = ['Logo Sieger.png', 'Logo Purina.png']

/** Invitan — fila superior (2 logos, pirámide). */
export const INVITAN_ROW_TOP: readonly string[] = ['Logo Duomo.png', 'Logo Filan.jpeg']

/** Invitan — fila inferior (3 logos). */
export const INVITAN_ROW_BOTTOM: readonly string[] = [
  'Logo Mate Rojo.png',
  'Logo Noziglia.png',
  'Logo Serin.png',
]

export const sponsorLogoSrc = (file: string) => encodeURI(`/${file}`)
