"use client";

import { usePitchQr } from "./use-pitch-qr";

// Backward-compatible alias while the codebase finishes renaming
// "event qr" references to the existing pitch QR flow.
export const useEventQr = usePitchQr;
