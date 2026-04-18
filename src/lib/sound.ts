let audio: HTMLAudioElement | null = null;
let lastPlayed = 0;

export function initSound() {
  if (!audio) {
    audio = new Audio("/sounds/golf-cup.wav");
    audio.volume = 0.35;
    audio.preload = "auto";
  }
}

export function playCupSound() {
  if (!audio) return;

  const now = Date.now();

  // prevent spam (min 800ms between sounds)
  if (now - lastPlayed < 800) return;

  lastPlayed = now;

  try {
    audio.currentTime = 0;

    // slight pitch variation (more realistic)
    audio.playbackRate = 0.95 + Math.random() * 0.1;

    audio.play().catch(() => {});
  } catch {}
}
