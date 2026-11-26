/**
 * @module VisualManager/colorSchemeManager
 *
 * Mantine MantineColorSchemeManager backed by WXT storage instead of
 * window.localStorage. The `subscribe` hook bridges storage.watch into
 * Mantine's reactive system, so a scheme change made in any surface (or any
 * extension context) updates every other surface live.
 */

import type { MantineColorScheme, MantineColorSchemeManager } from '@mantine/core';
import { colorSchemePreference, visualColorSchemeStorage } from './storages';

export function extStorageColorSchemeManager(
  initialColorScheme?: MantineColorScheme,
  onPreferenceChange?: (value: MantineColorScheme) => void
): MantineColorSchemeManager {
  // Mantine's `get` is synchronous while WXT storage is async; track the
  // last known value in a closure, seeded from the hydrated initial state.
  let currentColorScheme = initialColorScheme;
  let unwatch: (() => void) | undefined;
  // Bumped by every newer source of truth (watch event, local set, new or
  // ended subscription) so a catch-up read cannot overwrite it.
  let revision = 0;
  // A subscriber may call set (as unpatched Mantine does). Writing a storage
  // notification back can create an echo loop between surfaces.
  let applyingStoredValue = false;
  const applyStored = (onUpdate: (value: MantineColorScheme) => void, value: MantineColorScheme) => {
    currentColorScheme = value;
    onPreferenceChange?.(value);
    applyingStoredValue = true;
    try {
      onUpdate(value);
    } finally {
      applyingStoredValue = false;
    }
  };

  return {
    get: (defaultValue) => currentColorScheme ?? defaultValue,
    set: (value) => {
      revision++;
      currentColorScheme = value;
      if (applyingStoredValue) return;
      onPreferenceChange?.(value);
      colorSchemePreference.setValue(value).catch((error) => {
        console.warn('[VisualManager] failed to persist color scheme', error);
      });
    },
    subscribe: (onUpdate) => {
      // Defensive: a second subscribe without an interleaved unsubscribe
      // (StrictMode double-effects) must not leak the previous watcher.
      unwatch?.();
      unwatch = colorSchemePreference.watch((value) => {
        revision++;
        applyStored(onUpdate, value);
      });
      // The initial value was read before this subscription existed; catch
      // up on a change another surface made in between.
      const readRevision = ++revision;
      colorSchemePreference
        .getValue()
        .then((value) => {
          if (revision !== readRevision || value === currentColorScheme) return;
          applyStored(onUpdate, value);
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
      onPreferenceChange?.(visualColorSchemeStorage.fallback);
      colorSchemePreference.removeValue().catch((error) => {
        console.warn('[VisualManager] failed to clear color scheme', error);
      });
    },
  };
}
