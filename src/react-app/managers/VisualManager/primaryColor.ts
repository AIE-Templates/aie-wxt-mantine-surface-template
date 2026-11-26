import { generateColorsMap } from '@mantine/colors-generator';
import {
  DEFAULT_THEME,
  type MantineColorShade,
  type MantineColorsTuple,
  type MantineThemeOverride,
} from '@mantine/core';
import { appTheme } from '@/react-app/theme';
import { DEFAULT_PRIMARY_COLOR } from '@/react-app/theme-defaults';

export interface PrimaryPalette {
  preference: string;
  theme: Pick<MantineThemeOverride, 'primaryColor' | 'colors' | 'primaryShade'>;
}

function paletteFor(value: unknown): PrimaryPalette | undefined {
  if (typeof value !== 'string') return;
  if (Object.hasOwn(DEFAULT_THEME.colors, value) || Object.hasOwn(appTheme.colors ?? {}, value)) {
    return { preference: value, theme: { primaryColor: value } };
  }
  if (value.startsWith('#')) {
    try {
      const { colors, baseColorIndex } = generateColorsMap(value);
      return {
        preference: value,
        theme: {
          // A HEX preference replaces any appTheme palette named 'primary' while selected.
          primaryColor: 'primary',
          primaryShade: baseColorIndex as MantineColorShade,
          colors: { primary: colors.map((color) => color.hex()) as unknown as MantineColorsTuple },
        },
      };
    } catch {
      // A partial or invalid hex preference has no palette.
    }
  }
}

/** Resolve hydrated or newly selected colors for both the public hook and Mantine. */
export function resolvePrimaryColor(value: unknown, fallback: string = DEFAULT_PRIMARY_COLOR): PrimaryPalette {
  const palette = paletteFor(value);
  if (palette) return palette;
  console.warn('[VisualManager] invalid primaryColor, falling back to default', value);
  return (
    paletteFor(fallback) ?? {
      preference: DEFAULT_THEME.primaryColor,
      theme: { primaryColor: DEFAULT_THEME.primaryColor },
    }
  );
}
