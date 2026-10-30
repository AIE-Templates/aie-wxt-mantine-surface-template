/**
 * @module VisualManager/components/MantineRegistry
 *
 * Assembles the full Mantine provider stack. This is THE single place where
 * the SurfaceEnv is translated into Mantine wiring — shadow surfaces and
 * document surfaces differ only here:
 *
 * - cssVariablesSelector / getRootElement → theme root inside the shadow
 * - Portal defaultProps target            → floating layers stay in-shadow
 * - theme.scale                            → rem compensation
 * - forceColorScheme                       → colorSchemeStrategy
 *
 * Internal component; application code renders ManagersRegistry instead.
 */

import { useLayoutEffect, useMemo, useState, useSyncExternalStore, type PropsWithChildren } from 'react';
import { generateColorsMap } from '@mantine/colors-generator';
import {
  Combobox,
  createTheme,
  DirectionContext,
  Drawer,
  HoverCard,
  MantineProvider,
  Menu,
  mergeThemeOverrides,
  Modal,
  Popover,
  Tooltip,
  type MantineColorShade,
  type MantineColorsTuple,
  type MantinePrimaryShade,
  type MantineThemeOverride,
} from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { useSurface } from '@/surface/context';
import { appTheme } from '@/react-app/theme';
import { SURFACE_ROOT_CLASS, Z_INDEX } from '@/constants';
import { extStorageColorSchemeManager } from '../colorSchemeManager';
import type { VisualColorScheme, VisualDirection, VisualPrimaryColor } from '../defs';

const noopSubscribe = () => () => {};
const lightSnapshot = () => 'light' as const;

export interface MantineRegistryProps extends PropsWithChildren {
  colorScheme: VisualColorScheme;
  direction: VisualDirection;
  primaryColor: VisualPrimaryColor;
  onDirectionChange: (direction: VisualDirection) => void;
}

export default function MantineRegistry({
  colorScheme,
  direction,
  primaryColor,
  onDirectionChange,
  children,
}: MantineRegistryProps) {
  const env = useSurface();
  const isShadow = env.kind === 'shadow';
  const [colorSchemeManager] = useState(() => extStorageColorSchemeManager(colorScheme));

  // Hex primary colors get a generated palette; named colors resolve from
  // the application theme without flattening virtual colors.
  const { colors, baseColorIndex } = useMemo((): {
    colors: MantineColorsTuple | undefined;
    baseColorIndex: MantineColorShade | MantinePrimaryShade | undefined;
  } => {
    if (primaryColor.startsWith('#')) {
      const result = generateColorsMap(primaryColor);
      return {
        colors: result.colors.map((color) => color.hex()) as unknown as MantineColorsTuple,
        baseColorIndex: result.baseColorIndex as MantineColorShade,
      };
    }
    return { colors: undefined, baseColorIndex: undefined };
  }, [primaryColor]);

  const theme = useMemo(() => {
    const overrides: MantineThemeOverride = {
      scale: env.scale,
      ...(colors
        ? {
            colors: { primary: colors },
            primaryColor: 'primary',
            primaryShade: baseColorIndex,
          }
        : { primaryColor }),
      components: {
        ...(isShadow
          ? {
              // lockScroll mutates the HOST page (react-remove-scroll sets
              // overflow:hidden + rewrites body padding + data attributes on
              // document.body) — never acceptable from an injected surface.
              // `centered` comes from appTheme; mergeThemeOverrides deep-merges defaultProps.
              Modal: Modal.extend({ defaultProps: { zIndex: Z_INDEX.modal, lockScroll: false } }),
              Drawer: Drawer.extend({ defaultProps: { zIndex: Z_INDEX.modal, lockScroll: false } }),
              // Floating overlays portal to the surface root as SIBLINGS of
              // the main UI — Mantine's default z-index (300) would leave
              // them buried under the panel that opened them. The 'fixed'
              // strategy makes coordinates viewport-based, immune to the
              // shadow-internal offsetParent chain and host page scrolling.
              // This must cover the WHOLE @mantine/core floating family — any
              // uncovered member's dropdown gets buried under the panel.
              Popover: Popover.extend({
                defaultProps: { zIndex: Z_INDEX.popover, floatingStrategy: 'fixed' },
              }),
              Tooltip: Tooltip.extend({
                defaultProps: { zIndex: Z_INDEX.popover, floatingStrategy: 'fixed' },
              }),
              // Cursor-following tooltip variant: accepts zIndex but NOT
              // floatingStrategy (its position is hook-computed, not Floating-UI).
              TooltipFloating: Tooltip.Floating.extend({
                defaultProps: { zIndex: Z_INDEX.popover },
              }),
              Menu: Menu.extend({
                defaultProps: { zIndex: Z_INDEX.popover, floatingStrategy: 'fixed' },
              }),
              HoverCard: HoverCard.extend({
                defaultProps: { zIndex: Z_INDEX.popover, floatingStrategy: 'fixed' },
              }),
              // Extending Combobox covers Select/MultiSelect/Autocomplete/
              // TagsInput too: they render an inner <Combobox> via useProps,
              // and don't pass explicit zIndex/floatingStrategy, so these
              // theme defaults flow through.
              Combobox: Combobox.extend({
                defaultProps: { zIndex: Z_INDEX.popover, floatingStrategy: 'fixed' },
              }),
            }
          : {}),
      },
    };
    const merged = mergeThemeOverrides(appTheme, createTheme(overrides));
    if (isShadow) {
      // Assign DOM nodes after deep-merging: Mantine's generic merge would
      // clone the element into a plain object if appTheme also set a target.
      const portal = merged.components?.Portal;
      merged.components = {
        ...merged.components,
        Portal: { ...portal, defaultProps: { ...portal?.defaultProps, target: env.portalTarget } },
      };
    }
    return merged;
  }, [env, isShadow, colors, baseColorIndex, primaryColor]);

  // An external source is opt-in; the core never imports host detection.
  const source = typeof env.colorSchemeStrategy === 'object' ? env.colorSchemeStrategy : undefined;
  const externalScheme = useSyncExternalStore(
    source?.subscribe ?? noopSubscribe,
    source?.getSnapshot ?? lightSnapshot,
    source?.getSnapshot ?? lightSnapshot
  );
  const forceColorScheme = source
    ? externalScheme
    : env.colorSchemeStrategy === 'force-light'
      ? 'light'
      : env.colorSchemeStrategy === 'force-dark'
        ? 'dark'
        : undefined;

  // Mantine's DirectionProvider writes document.documentElement. Scope both
  // CSS direction and the context to this surface instead, including portals.
  useLayoutEffect(() => {
    const root = env.rootElement;
    const previous = root.getAttribute('dir');
    root.setAttribute('dir', direction);
    return () => {
      if (previous === null) root.removeAttribute('dir');
      else root.setAttribute('dir', previous);
    };
  }, [env.rootElement, direction]);
  const directionContext = useMemo(
    () => ({
      dir: direction,
      setDirection: onDirectionChange,
      toggleDirection: () => onDirectionChange(direction === 'ltr' ? 'rtl' : 'ltr'),
    }),
    [direction, onDirectionChange]
  );

  return (
    <DirectionContext.Provider value={directionContext}>
      <MantineProvider
        theme={theme}
        defaultColorScheme={colorScheme}
        forceColorScheme={forceColorScheme}
        colorSchemeManager={colorSchemeManager}
        cssVariablesSelector={isShadow ? `.${SURFACE_ROOT_CLASS}` : ':root'}
        getRootElement={() => env.rootElement}
      >
        <Notifications autoClose={5000} position="top-right" zIndex={isShadow ? Z_INDEX.notification : undefined} />
        <ModalsProvider>{children}</ModalsProvider>
      </MantineProvider>
    </DirectionContext.Provider>
  );
}
