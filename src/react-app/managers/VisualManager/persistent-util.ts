/**
 * @module VisualManager/persistent-util
 *
 * One-shot hydration of visual preferences before first render, so the UI
 * never flashes the wrong theme.
 */

import type { VisualColorScheme, VisualDirection, VisualPrimaryColor } from './defs';
import { visualColorSchemeStorage, visualDirectionStorage, visualPrimaryColorStorage } from './storages';

export interface VisualPersistentState {
  colorScheme: VisualColorScheme;
  direction: VisualDirection;
  primaryColor: VisualPrimaryColor;
}

export async function getVisualPersistentState(): Promise<VisualPersistentState> {
  const [colorScheme, direction, primaryColor] = await Promise.all([
    visualColorSchemeStorage.getValue(),
    visualDirectionStorage.getValue(),
    visualPrimaryColorStorage.getValue(),
  ]);
  return { colorScheme, direction, primaryColor };
}
