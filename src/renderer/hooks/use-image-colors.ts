import { useEffect, useState } from 'react';

interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface CardColors {
  bg: string;        // 60% — darkened dominant color
  accent: string;    // 10% — vibrant highlight
  accentLight: string; // brightened accent for beam head
  text: string;      // primary text — contrast-safe
  textMuted: string; // secondary text — slightly dimmer
}

function luminance({ r, g, b }: RGB): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function saturation({ r, g, b }: RGB): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

function darken({ r, g, b }: RGB, factor: number): RGB {
  return {
    r: Math.round(r * factor),
    g: Math.round(g * factor),
    b: Math.round(b * factor),
  };
}

function toCSS({ r, g, b }: RGB, alpha = 1): string {
  return alpha < 1
    ? `rgba(${r}, ${g}, ${b}, ${alpha})`
    : `rgb(${r}, ${g}, ${b})`;
}

function distance(a: RGB, b: RGB): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function extractColors(imageData: ImageData, k = 5): RGB[] {
  const pixels: RGB[] = [];
  const { data, width, height } = imageData;

  // Sample every 4th pixel for performance
  const step = 4;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Skip pure black and near-white pixels, but keep dark colorful ones
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const avg = (r + g + b) / 3;
      const hasChromaticity = max - min > 10;
      if ((avg > 5 || hasChromaticity) && avg < 240) {
        pixels.push({ r, g, b });
      }
    }
  }

  if (pixels.length === 0) return [{ r: 30, g: 30, b: 40 }];

  // Simple k-means clustering
  let centroids: RGB[] = [];
  for (let i = 0; i < k; i++) {
    centroids.push(pixels[Math.floor((i / k) * pixels.length)]);
  }

  for (let iter = 0; iter < 10; iter++) {
    const clusters: RGB[][] = centroids.map((): RGB[] => []);

    for (const pixel of pixels) {
      let minDist = Infinity;
      let closest = 0;
      for (let c = 0; c < centroids.length; c++) {
        const d = distance(pixel, centroids[c]);
        if (d < minDist) {
          minDist = d;
          closest = c;
        }
      }
      clusters[closest].push(pixel);
    }

    centroids = clusters.map((cluster, i) => {
      if (cluster.length === 0) return centroids[i];
      const sum = cluster.reduce(
        (acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }),
        { r: 0, g: 0, b: 0 },
      );
      return {
        r: Math.round(sum.r / cluster.length),
        g: Math.round(sum.g / cluster.length),
        b: Math.round(sum.b / cluster.length),
      };
    });
  }

  return centroids;
}

function vibrancy({ r, g, b }: RGB): number {
  // Score combining saturation with brightness — prefers colors that are
  // both colorful AND visible, not just high saturation ratio on dark pixels
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const brightness = max / 255;
  return chroma * (0.3 + 0.7 * brightness);
}

function brighten({ r, g, b }: RGB, target: number): RGB {
  // Boost a color so its max channel reaches the target (0–255)
  const max = Math.max(r, g, b, 1);
  const factor = target / max;
  return {
    r: Math.min(255, Math.round(r * factor)),
    g: Math.min(255, Math.round(g * factor)),
    b: Math.min(255, Math.round(b * factor)),
  };
}

function deriveCardColors(colors: RGB[]): CardColors {
  // Pick the most vibrant color as accent (saturation * brightness)
  const byVibrancy = [...colors].sort((a, b) => vibrancy(b) - vibrancy(a));
  let accent = byVibrancy[0];

  // If the accent is too dark to be visible, boost it while preserving hue
  if (Math.max(accent.r, accent.g, accent.b) < 100) {
    accent = brighten(accent, 180);
  }

  // For bg, pick the 2nd most vibrant color (after accent) so the card
  // gets a visibly tinted background rather than near-black.
  const bgBase = byVibrancy.length > 1 ? byVibrancy[1] : byVibrancy[0];

  // Target bg luminance around 0.04–0.06 so it's visible but dark
  const bgLumRaw = luminance(bgBase);
  let bg: RGB;
  if (bgLumRaw < 0.01) {
    // Extremely dark — boost then darken to get a tinted bg
    bg = darken(brighten(bgBase, 80), 0.4);
  } else if (bgLumRaw < 0.08) {
    bg = bgBase; // already in the sweet spot
  } else {
    // Scale down to target ~0.05 luminance
    const factor = 0.05 / bgLumRaw;
    bg = darken(bgBase, Math.max(0.15, Math.min(0.8, factor)));
  }

  const bgLum = luminance(bg);

  // Text colors based on bg luminance
  const textColor = bgLum > 0.4
    ? { r: 20, g: 20, b: 30 }
    : { r: 235, g: 235, b: 240 };
  const textMutedColor = bgLum > 0.4
    ? { r: 60, g: 60, b: 75 }
    : { r: 170, g: 170, b: 185 };

  return {
    bg: toCSS(bg),
    accent: toCSS(accent),
    accentLight: toCSS(brighten(accent, 240)),
    text: toCSS(textColor),
    textMuted: toCSS(textMutedColor),
  };
}

export function useImageColors(src: string | undefined, label?: string): CardColors | null {
  const [colors, setColors] = useState<CardColors | null>(null);

  useEffect(() => {
    if (!src) {
      setColors(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const size = 64; // downsample for speed
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, size, size);
      const imageData = ctx.getImageData(0, 0, size, size);
      const extracted = extractColors(imageData);
      const derived = deriveCardColors(extracted);
      console.log('[useImageColors]', label ?? src, { extracted, derived });
      setColors(derived);
    };
    img.src = src;
  }, [src]);

  return colors;
}
