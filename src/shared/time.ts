export function framesToMs(minutes: number, seconds: number, frames: number) {
  return (minutes * 60 + seconds) * 1000 + Math.round(frames * (1000 / 75));
}
