/** Motion-Tokens für `motion` (CSS-Pendants in tokens.css: --dur-*, --ease-*). */
export const SPRING_SHEET = { type: 'spring', stiffness: 520, damping: 42, mass: 0.9 } as const;
export const SPRING_SOFT = { type: 'spring', stiffness: 260, damping: 30 } as const;
export const EASE_OUT = [0.2, 0.8, 0.2, 1] as const;
export const DUR = { fast: 0.12, base: 0.2, slow: 0.36, screen: 0.24 } as const;
