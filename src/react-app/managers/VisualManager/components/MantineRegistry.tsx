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

import { useMemo, useState, type PropsWithChildren } from 'react';
import { generateColorsMap } from '@mantine/colors-generator';
import {
  Combobox,
  createTheme,
  DEFAULT_THEME,
  DirectionProvider,
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
import { SURFACE_ROOT_CLASS, Z_INDEX } from '@/constants';
import { extStorageColorSchemeManager } from '../colorSchemeManager';
import type { VisualColorScheme, VisualDirection, VisualPrimaryColor } from '../defs';

/**
 * Base theme applied regardless of surface or primary color.
 * `focusRing: 'auto'` keeps the ring for keyboard focus only.
 */
const baseTheme = createTheme({
  focusRing: 'auto',
  components: {
    Modal: Modal.extend({
      defaultProps: {
        centered: true,
      },
    }),
  },
});

export interface MantineRegistryProps extends PropsWithChildren {
  colorScheme: VisualColorScheme;
  direction: VisualDirection;
  primaryColor: VisualPrimaryColor;
}

export default function MantineRegistry({ colorScheme, direction, primaryColor, children }: MantineRegistryProps) {
  const env = useSurface();
  const isShadow = env.kind === 'shadow';
  const [colorSchemeManager] = useState(() => extStorageColorSchemeManager(colorScheme));

  // Hex primary colors get a generated palette; named colors resolve from
  // the default theme.
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
    return {
      colors: DEFAULT_THEME.colors[primaryColor],
      baseColorIndex: DEFAULT_THEME.primaryShade,
    };
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
        : {}),
      components: {
        ...(isShadow
          ? {
              Portal: { defaultProps: { target: env.portalTarget } },
              // lockScroll mutates the HOST page (react-remove-scroll sets
              // overflow:hidden + rewrites body padding + data attributes on
              // document.body) — never acceptable from an injected surface.
              // `centered` comes from baseTheme; mergeThemeOverrides deep-merges defaultProps.
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
    return mergeThemeOverrides(baseTheme, createTheme(overrides));
  }, [env, isShadow, colors, baseColorIndex]);

  const forceColorScheme =
    env.colorSchemeStrategy === 'force-light' ? 'light' : env.colorSchemeStrategy === 'force-dark' ? 'dark' : undefined;

  return (
    <DirectionProvider initialDirection={direction}>
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
    </DirectionProvider>
  );
}
