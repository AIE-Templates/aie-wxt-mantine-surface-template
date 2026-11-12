/**
 * @module VisualManager/colorSchemeManager
 *
 * Mantine MantineColorSchemeManager backed by WXT storage instead of
 * window.localStorage. The `subscribe` hook bridges storage.watch into
 * Mantine's reactive system, so a scheme change made in any surface (or any
 * extension context) updates every other surface live.
 */

import type { MantineColorScheme, MantineColorSchemeManager } from '@mantine/core';
import { visualColorSchemeStorage } from './storages';

export function extStorageColorSchemeManager(initialColorScheme?: MantineColorScheme): MantineColorSchemeManager {
  // Mantine's `get` is synchronous while WXT storage is async; track the
  // last known value in a closure, seeded from the hydrated initial state.
  let currentColorScheme = initialColorScheme;
  let unwatch: (() => void) | undefined;
  // Bumped by every newer source of truth (watch event, local set, new or
  // ended subscription) so a catch-up read cannot overwrite it.
  let revision = 0;

  return {
    get: (defaultValue) => currentColorScheme ?? defaultValue,
    set: (value) => {
      revision++;
      currentColorScheme = value;
      visualColorSchemeStorage.setValue(value).catch((error) => {
        console.warn('[VisualManager] failed to persist color scheme', error);
      });
    },
    subscribe: (onUpdate) => {
      // Defensive: a second subscribe without an interleaved unsubscribe
      // (StrictMode double-effects) must not leak the previous watcher.
      unwatch?.();
      unwatch = visualColorSchemeStorage.watch((value) => {
        revision++;
        currentColorScheme = value;
        onUpdate(value);
      });
      // The initial value was read before this subscription existed; catch
      // up on a change another surface made in between.
      const readRevision = ++revision;
      visualColorSchemeStorage
        .getValue()
        .then((value) => {
          if (revision !== readRevision || value === currentColorScheme) return;
          currentColorScheme = value;
          onUpdate(value);
        })
        .catch((error) => {
          console.warn('[VisualManager] failed to read color scheme', error);
        });
    },
    unsubscribe: () => {
      revision++;
      unwatch?.();
      unwatch = undefined;
    },
    clear: () => {
      revision++;
      currentColorScheme = undefined;
      visualColorSchemeStorage.removeValue().catch((error) => {
        console.warn('[VisualManager] failed to clear color scheme', error);
      });
    },
  };
}
