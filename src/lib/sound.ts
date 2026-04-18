let audio: HTMLAudioElement | null = null;

export function initSound() {
  if (!audio) {
    audio = new Audio("/sounds/golf-cup.wav");
    audio.volume = 0.35;
    audio.preload = "auto";
  }
}

export function playCupSound() {
  if (!audio) return;

  try {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {}
}
