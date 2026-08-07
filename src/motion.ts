export const SHELF_PANEL_FADE_DURATION_SECONDS = 0.28;
export const SHELF_CONTENT_SWAP_DURATION_MS = SHELF_PANEL_FADE_DURATION_SECONDS * 2_000;

export const SPLASH_MOTION = {
  easing: [0, 0, 0.58, 1] as const,
  lineEasing: [0.76, 0, 0.24, 1] as const,
  entranceDurationMs: 2300,
  items: {
    fairRule: { delayMs: 0, durationMs: 360, axis: 'y' },
    brandRule: { delayMs: 100, durationMs: 640, axis: 'y' },
    logoRule: { delayMs: 240, durationMs: 480, axis: 'x' },
    descriptionRule: { delayMs: 360, durationMs: 560, axis: 'y' },
    descriptionAccent: { delayMs: 480, durationMs: 360, axis: 'x' },
    ctaRule: { delayMs: 560, durationMs: 400, axis: 'x' },
    footerRule: { delayMs: 640, durationMs: 520, axis: 'x' },
    eventSlash: { delayMs: 760, durationMs: 420, axis: 'reveal' },
    fairLabel: { delayMs: 1220, durationMs: 260, initialYpx: 8 },
    logo: { delayMs: 1290, durationMs: 300, initialYpx: 8 },
    titleThe: { delayMs: 1360, durationMs: 320, initialYpx: 10 },
    eventDate: { delayMs: 1430, durationMs: 340, initialYpx: 10 },
    titleChoiceMaker: { delayMs: 1500, durationMs: 320, initialYpx: 10 },
    eventHall: { delayMs: 1570, durationMs: 340, initialYpx: 10 },
    titleKorea: { delayMs: 1640, durationMs: 320, initialYpx: 10 },
    eventStandLeft: { delayMs: 1710, durationMs: 340, initialYpx: 10 },
    eventStandRight: { delayMs: 1780, durationMs: 340, initialYpx: 10 },
    description: { delayMs: 1850, durationMs: 280, initialYpx: 8 },
    cta: { delayMs: 1940, durationMs: 260, initialYpx: 6 },
    footer: { delayMs: 2000, durationMs: 300, initialYpx: 6 },
  },
} as const;
export const SPLASH_EXIT_MOTION = {
  durationMs: 160,
  easing: SPLASH_MOTION.easing,
} as const;


export const SPLASH_LINE_ITEMS = [
  'fairRule',
  'brandRule',
  'logoRule',
  'descriptionRule',
  'descriptionAccent',
  'ctaRule',
  'footerRule',
  'eventSlash',
] as const;

export type SplashMotionItem = keyof typeof SPLASH_MOTION.items;
export type SplashLineMotionItem = typeof SPLASH_LINE_ITEMS[number];
export type SplashTextMotionItem = Exclude<SplashMotionItem, SplashLineMotionItem>;

export function splashMotionTransition(item: SplashMotionItem) {
  const timing = SPLASH_MOTION.items[item];
  return {
    delay: timing.delayMs / 1_000,
    duration: timing.durationMs / 1_000,
    ease: SPLASH_LINE_ITEMS.includes(item as SplashLineMotionItem)
      ? SPLASH_MOTION.lineEasing
      : SPLASH_MOTION.easing,
  };
}

export function splashExitTransition() {
  return {
    duration: SPLASH_EXIT_MOTION.durationMs / 1_000,
    ease: SPLASH_EXIT_MOTION.easing,
  };
}
export type SplashEntryCommit = { current: boolean };

export function commitSplashEntry(state: SplashEntryCommit) {
  if (state.current) return false;
  state.current = true;
  return true;
}

export type SplashEntranceCompletion = {
  activeGeneration: number;
  callbackGeneration: number;
  reducedMotion: boolean;
  phase: 'entering' | 'entered';
};

export function canCompleteSplashEntrance(state: SplashEntranceCompletion) {
  return state.activeGeneration === state.callbackGeneration
    && !state.reducedMotion
    && state.phase === 'entering';
}
