/**
 * @module VisualManager/registry
 *
 * Orchestrator of the visual subsystem: owns React state for visual
 * preferences, persists them to WXT storage, and keeps every surface in
 * sync by watching the same storage items (color scheme syncs through the
 * colorSchemeManager; direction/primary color are watched here).
 */

import { useEffect, useState, type PropsWithChildren } from 'react';
import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import MantineRegistry from './components/MantineRegistry';
import VisualContextProvider from './context';
import type { VisualColorScheme, VisualDirection, VisualPrimaryColor } from './defs';
import type { VisualPersistentState } from './persistent-util';
import { visualColorSchemeStorage, visualDirectionStorage, visualPrimaryColorStorage } from './storages';

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
 * color scheme is written by the colorSchemeManager (via Mantine), the
 * other preferences are written here.
 */
function VisualStateBridge({ children, ...props }: VisualStateBridgeProps) {
  // keepTransitions: true is required for host isolation, not just for aesthetics.
  // Without it, Mantine's color-scheme toggle injects a global `*{transition:none}`
  // <style> tag into document.head (the host page) for ~10ms on every switch,
  // causing an unintended mutation. Do not remove this option.
  // (Side effect: our own UI animates the theme switch instead of hard-cutting,
  // which is acceptable. A scoped anti-flash inside the shadow root would need a
  // custom implementation.)
  const { setColorScheme: mantineSetColorScheme } = useMantineColorScheme({ keepTransitions: true });
  const activeColorScheme = useComputedColorScheme('light');
  const setColorScheme = (colorScheme: VisualColorScheme) => {
    props.onColorSchemeChange(colorScheme);
    mantineSetColorScheme(colorScheme); // → colorSchemeManager.set → storage
  };

  return (
    <VisualContextProvider
      colorScheme={props.colorScheme}
      activeColorScheme={activeColorScheme}
      direction={props.direction}
      primaryColor={props.primaryColor}
      setColorScheme={setColorScheme}
      toggleColorScheme={() => setColorScheme(activeColorScheme === 'light' ? 'dark' : 'light')}
      setDirection={props.onDirectionChange}
      toggleDirection={() => props.onDirectionChange(props.direction === 'ltr' ? 'rtl' : 'ltr')}
      setPrimaryColor={(primaryColor) => {
        props.onPrimaryColorChange(primaryColor);
        visualPrimaryColorStorage.setValue(primaryColor).catch((error) => {
          console.warn('[VisualManager] failed to persist primary color', error);
        });
      }}
    >
      {children}
    </VisualContextProvider>
  );
}

export interface VisualManagerRegistryProps extends PropsWithChildren {
  persistentState: VisualPersistentState;
}

const VisualManagerRegistry = ({ persistentState, children }: VisualManagerRegistryProps) => {
  const [state, setState] = useState(persistentState);

  // Cross-surface sync: another surface (popup, sidepanel, in-page UI)
  // changed a preference → storage watch fires here → this surface follows.
  useEffect(() => {
    const unwatchers = [
      visualColorSchemeStorage.watch((colorScheme) => setState((s) => ({ ...s, colorScheme }))),
      visualDirectionStorage.watch((direction) => setState((s) => ({ ...s, direction }))),
      visualPrimaryColorStorage.watch((primaryColor) => setState((s) => ({ ...s, primaryColor }))),
    ];
    return () => unwatchers.forEach((unwatch) => unwatch());
  }, []);

  const setDirection = (direction: VisualDirection) => {
    setState((s) => ({ ...s, direction }));
    visualDirectionStorage.setValue(direction).catch((error) => {
      console.warn('[VisualManager] failed to persist direction', error);
    });
  };

  return (
    <MantineRegistry
      colorScheme={state.colorScheme}
      direction={state.direction}
      primaryColor={state.primaryColor}
      onDirectionChange={setDirection}
    >
      <VisualStateBridge
        colorScheme={state.colorScheme}
        direction={state.direction}
        primaryColor={state.primaryColor}
        onColorSchemeChange={(colorScheme) => setState((s) => ({ ...s, colorScheme }))}
        onDirectionChange={setDirection}
        onPrimaryColorChange={(primaryColor) => setState((s) => ({ ...s, primaryColor }))}
      >
        {children}
      </VisualStateBridge>
    </MantineRegistry>
  );
};

export default VisualManagerRegistry;
