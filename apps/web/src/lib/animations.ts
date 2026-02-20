import type { Variants, Transition } from 'framer-motion'

// ── Shared timing ──────────────────────────────────────────
export const spring: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
}

export const smooth: Transition = {
  duration: 0.3,
  ease: [0.16, 1, 0.3, 1],
}

export const gentle: Transition = {
  duration: 0.4,
  ease: [0.4, 0, 0.2, 1],
}

// ── Fade variants ──────────────────────────────────────────
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: smooth },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

// ── Slide variants ─────────────────────────────────────────
export const slideUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: smooth },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
}

export const slideDown: Variants = {
  hidden: { opacity: 0, y: -12 },
  visible: { opacity: 1, y: 0, transition: smooth },
  exit: { opacity: 0, y: 8, transition: { duration: 0.15 } },
}

export const slideLeft: Variants = {
  hidden: { opacity: 0, x: 16 },
  visible: { opacity: 1, x: 0, transition: smooth },
  exit: { opacity: 0, x: -16, transition: { duration: 0.15 } },
}

export const slideRight: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: smooth },
  exit: { opacity: 0, x: 16, transition: { duration: 0.15 } },
}

// ── Scale variants ─────────────────────────────────────────
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: smooth },
  exit: { opacity: 0, scale: 0.97, transition: { duration: 0.15 } },
}

// ── Stagger children ───────────────────────────────────────
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
}

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: smooth,
  },
}

// ── Page transition ────────────────────────────────────────
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.15 },
  },
}
