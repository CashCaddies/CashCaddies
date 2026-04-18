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
  if (now - lastPlayed < 200) return;
  lastPlayed = now;

  try {
    audio.currentTime = 0;

    // slight variation
    audio.playbackRate = 0.95 + Math.random() * 0.1;

    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise.catch(() => {});
    }
  } catch {}
}

/** Same shared cup / portal tap sound as header golf ball and notifications. */
export const playPortalSound = playCupSound;
