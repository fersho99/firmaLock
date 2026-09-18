let pauseCount = 0;

export function isRelockPaused(): boolean {
  return pauseCount > 0;
}

export function pauseRelock(): void {
  pauseCount += 1;
}

export function resumeRelock(): void {
  pauseCount = Math.max(0, pauseCount - 1);
}

export async function withRelockPaused<T>(fn: () => Promise<T>): Promise<T> {
  pauseRelock();
  try {
    return await fn();
  } finally {
    resumeRelock();
  }
}
