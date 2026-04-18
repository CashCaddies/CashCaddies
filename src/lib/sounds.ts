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

  // block rapid spam
  if (now - lastPlayed < 800) return;

  try {
    audio.currentTime = 0;

    // slight variation
    audio.playbackRate = 0.95 + Math.random() * 0.1;

    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          // ONLY update after success
          lastPlayed = Date.now();
        })
        .catch(() => {});
    }
  } catch {}
}

/** Same shared cup / portal tap sound as header golf ball and notifications. */
export const playPortalSound = playCupSound;
