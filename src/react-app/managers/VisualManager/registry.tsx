/**
 * @module VisualManager/registry
 *
 * Orchestrator of the visual subsystem: owns React state for visual
 * preferences, persists them to WXT storage, and keeps every surface in
 * sync by watching the same storage items (color scheme syncs through the
 * colorSchemeManager; direction/primary color are watched here).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { useSurface } from '@/surface/context';
import MantineRegistry from './components/MantineRegistry';
import VisualContextProvider from './context';
import type { VisualColorScheme, VisualDirection, VisualPrimaryColor } from './defs';
import type { VisualPersistentState } from './persistent-util';
import { resolvePrimaryColor } from './primaryColor';
import { colorSchemePreference, directionPreference, primaryColorPreference } from './storages';

interface VisualStateBridgeProps extends PropsWithChildren {
  colorScheme: VisualColorScheme;
  direction: VisualDirection;
  primaryColor: VisualPrimaryColor;
  onColorSchemeChange: (colorScheme: VisualColorScheme) => void;
  onDirectionChange: (direction: VisualDirection) => void;
  onPrimaryColorChange: (primaryColor: VisualPrimaryColor) => void;
}

/**
 * Lives inside MantineProvider; consumes Mantine's raw hooks and exposes
 * unified change handlers through the VisualContext. Persistence rules:
 * in `'extension'` mode, color scheme is written once by the colorSchemeManager
 * (via Mantine); under forced/external schemes Mantine's setter is a no-op, so
 * this bridge persists the preference directly. Direction and primary color are
 * always persisted by the manager registry / bridge.
 */
function VisualStateBridge({
  children,
  colorScheme,
  direction,
  primaryColor,
  onColorSchemeChange,
  onDirectionChange,
  onPrimaryColorChange,
}: VisualStateBridgeProps) {
  const env = useSurface();
  const persistDirectly = env.colorSchemeStrategy !== 'extension';
  // keepTransitions: true is required for host isolation, not just for aesthetics.
  // Without it, Mantine's color-scheme toggle injects a global `*{transition:none}`
  // <style> tag into document.head (the host page) for ~10ms on every switch,
  // causing an unintended mutation. Do not remove this option.
  // (Side effect: our own UI animates the theme switch instead of hard-cutting,
  // which is acceptable. A scoped anti-flash inside the shadow root would need a
  // custom implementation.)
  const { setColorScheme: mantineSetColorScheme } = useMantineColorScheme({ keepTransitions: true });
  const activeColorScheme = useComputedColorScheme('light');
  const setColorScheme = useCallback(
    (next: VisualColorScheme) => {
      onColorSchemeChange(next);
      // Under a forced or external scheme, Mantine's setter is a no-op so
      // colorSchemeManager.set never runs; persist directly there and let
      // Mantine handle the single storage write in `'extension'` mode.
      if (persistDirectly) {
        colorSchemePreference.setValue(next).catch((error) => {
          console.warn('[VisualManager] failed to persist color scheme', error);
        });
      } else {
        mantineSetColorScheme(next);
      }
    },
    [onColorSchemeChange, persistDirectly, mantineSetColorScheme]
  );
  const toggleColorScheme = useCallback(() => {
    // Resolve the saved 'auto' preference at click time, even on a forced surface.
    const dark =
      colorScheme === 'auto' ? window.matchMedia('(prefers-color-scheme: dark)').matches : colorScheme === 'dark';
    setColorScheme(dark ? 'light' : 'dark');
  }, [setColorScheme, colorScheme]);
  const toggleDirection = useCallback(
    () => onDirectionChange(direction === 'ltr' ? 'rtl' : 'ltr'),
    [onDirectionChange, direction]
  );
  const setPrimaryColor = useCallback(
    (next: VisualPrimaryColor) => {
      onPrimaryColorChange(next);
      primaryColorPreference.setValue(next).catch((error) => {
        console.warn('[VisualManager] failed to persist primary color', error);
      });
    },
    [onPrimaryColorChange]
  );

  return (
    <VisualContextProvider
      colorScheme={colorScheme}
      activeColorScheme={activeColorScheme}
      direction={direction}
      primaryColor={primaryColor}
      setColorScheme={setColorScheme}
      toggleColorScheme={toggleColorScheme}
      setDirection={onDirectionChange}
      toggleDirection={toggleDirection}
      setPrimaryColor={setPrimaryColor}
    >
      {children}
    </VisualContextProvider>
  );
}

export interface VisualManagerRegistryProps extends PropsWithChildren {
  persistentState: VisualPersistentState;
}

type VisualKey = keyof VisualPersistentState;

const VisualManagerRegistry = ({ persistentState, children }: VisualManagerRegistryProps) => {
  const [state, setState] = useState(persistentState);
  const palette = useMemo(() => resolvePrimaryColor(state.primaryColor), [state.primaryColor]);
  // Per preference: bumped by every newer value (watch event, local change)
  // so a catch-up read cannot overwrite it.
  const revisions = useRef<Record<VisualKey, number>>({ colorScheme: 0, direction: 0, primaryColor: 0 });
  const update = useCallback(<K extends VisualKey>(key: K, value: VisualPersistentState[K]) => {
    revisions.current[key]++;
    setState((s) => (s[key] === value ? s : { ...s, [key]: value }));
  }, []);

  // Cross-surface sync: another surface (popup, sidepanel, in-page UI)
  // changed a preference → storage watch fires here → this surface follows.
  // `persistentState` was read before this subscription existed, so read once
  // more after subscribing to catch a change made in between.
  useEffect(() => {
    let active = true;
    const follow = <K extends VisualKey>(
      key: K,
      item: {
        watch: (callback: (value: VisualPersistentState[K]) => void) => () => void;
        getValue: () => Promise<VisualPersistentState[K]>;
      }
    ) => {
      const unwatch = item.watch((value) => update(key, value));
      const readRevision = revisions.current[key];
      item
        .getValue()
        .then((value) => {
          if (active && revisions.current[key] === readRevision) update(key, value);
        })
        .catch((error) => {
          console.warn(`[VisualManager] failed to read ${key}`, error);
        });
      return unwatch;
    };
    const unwatchers = [
      follow('colorScheme', colorSchemePreference),
      follow('direction', directionPreference),
      follow('primaryColor', primaryColorPreference),
    ];
    return () => {
      active = false;
      unwatchers.forEach((unwatch) => unwatch());
    };
  }, [update]);

  const setDirection = useCallback(
    (direction: VisualDirection) => {
      update('direction', direction);
      directionPreference.setValue(direction).catch((error) => {
        console.warn('[VisualManager] failed to persist direction', error);
      });
    },
    [update]
  );

  const onColorSchemeChange = useCallback(
    (colorScheme: VisualColorScheme) => update('colorScheme', colorScheme),
    [update]
  );

  const onPrimaryColorChange = useCallback(
    (primaryColor: VisualPrimaryColor) => update('primaryColor', primaryColor),
    [update]
  );

  return (
    <MantineRegistry
      colorScheme={state.colorScheme}
      direction={state.direction}
      palette={palette.theme}
      onDirectionChange={setDirection}
    >
      <VisualStateBridge
        colorScheme={state.colorScheme}
        direction={state.direction}
        primaryColor={palette.preference}
        onColorSchemeChange={onColorSchemeChange}
        onDirectionChange={setDirection}
        onPrimaryColorChange={onPrimaryColorChange}
      >
        {children}
      </VisualStateBridge>
    </MantineRegistry>
  );
};

export default VisualManagerRegistry;
