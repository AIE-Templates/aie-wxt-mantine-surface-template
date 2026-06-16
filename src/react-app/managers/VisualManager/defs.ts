/**
 * @module VisualManager/defs
 *
 * Type definitions for the visual/theme subsystem.
 */

import type { MantineColorScheme } from '@mantine/core';

export type VisualColorScheme = MantineColorScheme; // 'auto' | 'light' | 'dark'
export type VisualDirection = 'ltr' | 'rtl';
/** Mantine palette name (e.g. 'blue') or a hex color (palette generated on the fly). */
export type VisualPrimaryColor = string;

export interface VisualContextValues {
  colorScheme: VisualColorScheme;
  /** Resolved scheme after 'auto' is applied. */
  activeColorScheme: 'light' | 'dark';
  direction: VisualDirection;
  primaryColor: VisualPrimaryColor;
  setColorScheme: (colorScheme: VisualColorScheme) => void;
  toggleColorScheme: () => void;
  setDirection: (direction: VisualDirection) => void;
  toggleDirection: () => void;
  setPrimaryColor: (primaryColor: VisualPrimaryColor) => void;
}
