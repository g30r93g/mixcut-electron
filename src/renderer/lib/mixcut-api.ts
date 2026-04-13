import type { MixcutApi } from '../../preload/index';

declare global {
  interface Window {
    mixcut: MixcutApi;
  }
}

export const mixcut = window.mixcut;
