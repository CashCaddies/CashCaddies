let audio: HTMLAudioElement | null = null;
let lastPlayed = 0;

export function initSound() {
  if (!audio) {
    audio = new Audio("/sounds/golf-cup.wav");
    audio.volume = 0.35;
    audio.preload = "auto";
  }
}

export const playPortalSound = () => {
  const now = Date.now();

  // allow ~5 plays per second max
  if (now - lastPlayed < 200) return;
  lastPlayed = now;

  try {
    if (!audio) return;

    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {}
};

/** Same shared cup / portal tap sound as header golf ball and notifications. */
export const playCupSound = playPortalSound;
