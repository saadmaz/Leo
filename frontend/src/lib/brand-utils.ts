const BRAND_GRADIENTS = [
  'from-violet-500/20 to-purple-600/20',
  'from-blue-500/20 to-cyan-500/20',
  'from-emerald-500/20 to-teal-500/20',
  'from-amber-500/20 to-orange-500/20',
  'from-rose-500/20 to-pink-500/20',
  'from-indigo-500/20 to-violet-500/20',
]

const BRAND_TEXT_COLORS = [
  'text-violet-400',
  'text-blue-400',
  'text-emerald-400',
  'text-amber-400',
  'text-rose-400',
  'text-indigo-400',
]

function nameHash(name: string): number {
  return name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
}

export function getBrandGradient(name: string): string {
  return BRAND_GRADIENTS[nameHash(name) % BRAND_GRADIENTS.length]
}

export function getBrandTextColor(name: string): string {
  return BRAND_TEXT_COLORS[nameHash(name) % BRAND_TEXT_COLORS.length]
}

export function getBrandInitials(name: string): string {
  return name
    .split(/[\s\-_]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}
