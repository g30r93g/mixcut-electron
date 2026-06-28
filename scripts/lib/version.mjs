// Pure version helpers shared by CI scripts and unit tests. No Node-runtime
// state (no Date/env) so the logic stays deterministic and testable.

/** Compare dotted numeric versions segment-by-segment. Returns -1 | 0 | 1. */
export function compareSemverish(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

/** True iff `latest` is strictly newer than `current`. */
export function isNewer(latest, current) {
  return compareSemverish(latest, current) > 0;
}

/** Next CalVer app version: `<year>.<month>.<patch>`, patch increments within a month. */
export function computeCalVer(currentAppVersion, year, month) {
  const prefix = `${year}.${month}.`;
  let patch = 0;
  if (String(currentAppVersion).startsWith(prefix)) {
    const prev = parseInt(String(currentAppVersion).slice(prefix.length), 10);
    if (Number.isFinite(prev)) patch = prev + 1;
  }
  return `${year}.${month}.${patch}`;
}
