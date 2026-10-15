// Purple/indigo medical theme, ported from doctor-patient-v-1.0.html's
// `medical.*` Tailwind palette (primary brand = #7c3aed).
export const colors = {
  primary: '#7c3aed', // medical.600 / brand action color
  primaryLight: '#8b5cf6', // medical.500
  primaryDark: '#6d28d9', // medical.700 / hover
  accent: '#a855f7', // medical.accent
  indigo: '#4f46e5', // secondary accent
  surfaceTint: '#f5f3ff', // medical.50
  surfaceTint100: '#ede9fe', // medical.100
  bg: '#faf8ff', // screen background
  bgDark: '#0e0720', // app/dark background
  bezel: '#1f113a',
  text: '#1e1333',
  textMuted: '#6b6280',
  border: '#e4defa',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  white: '#ffffff',
} as const;

export const spacing = (n: number) => n * 4;
