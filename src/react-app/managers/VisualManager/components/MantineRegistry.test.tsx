/* eslint-disable no-restricted-syntax -- Tests inspect the host document to prove surface isolation. */
import { DEFAULT_THEME, Portal, useDirection, useMantineTheme, virtualColor } from '@mantine/core';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, onTestFinished, vi } from 'vitest';
import { followHostColorScheme } from '@/surface/addons/host-scheme';
import { createColorSchemeSource } from '@/surface/color-scheme';
import { SurfaceProvider } from '@/surface/context';
import type { SurfaceEnv } from '@/surface/defs';
import { documentSurface } from '@/surface/document';
import { createSatellite, SatelliteOutlet } from '@/surface/satellite';
import { DEFAULT_PRIMARY_COLOR } from '@/react-app/theme-defaults';
import { SURFACE_ROOT_CLASS, Z_INDEX } from '@/constants';
import { extStorageColorSchemeManager } from '../colorSchemeManager';
import { useVisual } from '../context';
import { resolvePrimaryColor } from '../primaryColor';
import VisualManagerRegistry from '../registry';
import { visualColorSchemeStorage, visualDirectionStorage, visualPrimaryColorStorage } from '../storages';
import MantineRegistry from './MantineRegistry';

vi.mock('@/react-app/theme', async () => {
  const { appTheme } = await vi.importActual<typeof import('@/react-app/theme')>('@/react-app/theme');
  return {
    appTheme: {
      ...appTheme,
      fontFamily: 'Example Sans',
      primaryShade: 5,
      colors: {
        renamedPalette: DEFAULT_THEME.colors.red,
        brand: virtualColor({ name: 'brand', light: 'blue', dark: 'cyan' }),
      },
      components: {
        ...appTheme.components,
        Portal: { defaultProps: { target: 'body' } },
        Modal: { defaultProps: { centered: true, lockScroll: true } },
      },
    },
  };
});

let testColorSchemeManager: ReturnType<typeof extStorageColorSchemeManager>;
beforeEach(() => {
  testColorSchemeManager = extStorageColorSchemeManager();
});

function shadowEnv(): SurfaceEnv {
  const host = document.createElement('div');
  document.body.append(host);
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const rootElement = document.createElement('div');
  rootElement.className = SURFACE_ROOT_CLASS;
  shadowRoot.append(rootElement);
  return {
    kind: 'shadow',
    shadowRoot,
    rootElement,
    portalTarget: rootElement,
    scale: 1.6,
    colorSchemeStrategy: 'extension',
  };
}

afterEach(async () => {
  cleanup();
  document.body.replaceChildren();
  document.body.style.backgroundColor = '';
  document.documentElement.removeAttribute('dir');
  await new Promise((resolve) => setTimeout(resolve, 0));
});

it('keeps direction local across setters, storage updates, portals and satellites', async () => {
  document.documentElement.setAttribute('dir', 'rtl');
  const env = shadowEnv();
  const anchor = document.createElement('p');
  document.body.append(anchor);
  const satellite = createSatellite(anchor, <span>satellite</span>);
  function Probe() {
    const visual = useVisual();
    const direction = useDirection();
    return (
      <>
        <button onClick={visual.toggleDirection}>visual toggle</button>
        <button onClick={() => direction.setDirection('ltr')}>mantine ltr</button>
        <Portal>
          <span data-testid="portal">{direction.dir}</span>
        </Portal>
      </>
    );
  }
  const view = render(
    <SurfaceProvider env={env}>
      <VisualManagerRegistry persistentState={{ direction: 'ltr', colorScheme: 'light', primaryColor: 'blue' }}>
        <SatelliteOutlet />
        <Probe />
      </VisualManagerRegistry>
    </SurfaceProvider>,
    { container: env.rootElement }
  );
  expect(env.rootElement.getAttribute('dir')).toBe('ltr');
  expect(env.portalTarget.querySelector('[data-testid="portal"]')?.textContent).toBe('ltr');
  const head = document.head.innerHTML;
  fireEvent.click(view.getByText('visual toggle'));
  expect(env.rootElement.getAttribute('dir')).toBe('rtl');
  expect(satellite.hostElement.shadowRoot?.querySelector(`.${SURFACE_ROOT_CLASS}`)?.getAttribute('dir')).toBe('rtl');
  await waitFor(async () => expect(await visualDirectionStorage.getValue()).toBe('rtl'));
  fireEvent.click(view.getByText('mantine ltr'));
  await waitFor(async () => expect(await visualDirectionStorage.getValue()).toBe('ltr'));
  expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  await act(async () => {
    await visualDirectionStorage.setValue('rtl');
  });
  await waitFor(() => expect(env.rootElement.getAttribute('dir')).toBe('rtl'));
  expect(document.documentElement.getAttribute('dir')).toBe('rtl');
  expect(document.head.innerHTML).toBe(head);
});

it('updates external schemes and cleans up when the source changes or unmounts', () => {
  const env = shadowEnv();
  const first = createColorSchemeSource('light');
  const second = createColorSchemeSource('dark');
  const off = vi.fn();
  const subscribe = first.subscribe;
  first.subscribe = vi.fn((listener) => {
    const stop = subscribe(listener);
    return () => {
      off();
      stop();
    };
  });
  const palette = resolvePrimaryColor('blue').theme;
  let theme!: ReturnType<typeof useMantineTheme>;
  function Probe() {
    theme = useMantineTheme();
    return null;
  }
  const app = (strategy: SurfaceEnv['colorSchemeStrategy']) => (
    <SurfaceProvider env={{ ...env, colorSchemeStrategy: strategy }}>
      <MantineRegistry
        colorSchemeManager={testColorSchemeManager}
        colorScheme="auto"
        direction="ltr"
        palette={palette}
        onDirectionChange={() => {}}
      >
        <Probe />
      </MantineRegistry>
    </SurfaceProvider>
  );
  const view = render(app(first), { container: env.rootElement });
  expect(env.rootElement.getAttribute('data-mantine-color-scheme')).toBe('light');
  act(() => first.set('dark'));
  expect(env.rootElement.getAttribute('data-mantine-color-scheme')).toBe('dark');
  const firstTheme = theme;
  view.rerender(app(second));
  expect(theme).toBe(firstTheme);
  expect(off).toHaveBeenCalledTimes(1);
  act(() => first.set('light'));
  expect(env.rootElement.getAttribute('data-mantine-color-scheme')).toBe('dark');
  view.rerender(app('force-light'));
  act(() => second.set('light'));
  act(() => second.set('dark'));
  expect(env.rootElement.getAttribute('data-mantine-color-scheme')).toBe('light');
  view.rerender(app(first));
  view.unmount();
  expect(off).toHaveBeenCalledTimes(2);
});

it('connects the optional host detector without mutating the host', async () => {
  const env = shadowEnv();
  env.colorSchemeStrategy = followHostColorScheme;
  document.body.style.backgroundColor = 'rgb(255, 255, 255)';
  render(
    <SurfaceProvider env={env}>
      <MantineRegistry
        colorSchemeManager={testColorSchemeManager}
        colorScheme="dark"
        direction="ltr"
        palette={resolvePrimaryColor('blue').theme}
        onDirectionChange={() => {}}
      />
    </SurfaceProvider>,
    { container: env.rootElement }
  );
  expect(env.rootElement.getAttribute('data-mantine-color-scheme')).toBe('light');
  const head = document.head.innerHTML;
  await act(async () => {
    document.body.style.backgroundColor = 'rgb(18, 18, 18)';
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  expect(env.rootElement.getAttribute('data-mantine-color-scheme')).toBe('dark');
  expect(document.head.innerHTML).toBe(head);
  expect(document.documentElement.hasAttribute('data-mantine-color-scheme')).toBe(false);
});

it('preserves application tokens and virtual colors while surface defaults win', () => {
  const env = shadowEnv();
  let theme!: ReturnType<typeof useMantineTheme>;
  function Probe() {
    theme = useMantineTheme();
    return null;
  }
  const app = (primaryColor: string) => (
    <SurfaceProvider env={env}>
      <MantineRegistry
        colorSchemeManager={testColorSchemeManager}
        colorScheme="light"
        direction="ltr"
        palette={resolvePrimaryColor(primaryColor).theme}
        onDirectionChange={() => {}}
      >
        <Probe />
      </MantineRegistry>
    </SurfaceProvider>
  );
  const view = render(app('brand'), { container: env.rootElement });
  expect(theme.primaryColor).toBe('brand');
  expect(theme.primaryShade).toBe(5);
  expect(theme.fontFamily).toBe('Example Sans');
  expect(theme.scale).toBe(1.6);
  expect(theme.components.Portal!.defaultProps.target).toBe(env.portalTarget);
  expect(theme.components.Modal!.defaultProps.lockScroll).toBe(false);
  expect(theme.components.Modal!.defaultProps.centered).toBe(true);
  view.rerender(app('renamedPalette'));
  expect(theme.primaryColor).toBe('renamedPalette');
  view.rerender(app('#ff0000'));
  expect(theme.primaryColor).toBe('primary');
  expect(theme.colors.primary).toHaveLength(10);
});

it('sets direction on an owned document and restores its original attribute on unmount', () => {
  document.documentElement.setAttribute('dir', 'rtl');
  const env = documentSurface();
  const view = render(
    <SurfaceProvider env={env}>
      <MantineRegistry
        colorSchemeManager={testColorSchemeManager}
        colorScheme="light"
        direction="ltr"
        palette={resolvePrimaryColor('blue').theme}
        onDirectionChange={() => {}}
      />
    </SurfaceProvider>
  );
  expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  view.unmount();
  expect(document.documentElement.getAttribute('dir')).toBe('rtl');
});

it.each([
  ['force-dark', 'dark'],
  ['external source', 'light'],
] as const)('persists the color scheme preference while the surface is %s', async (_mode, visible) => {
  const env = shadowEnv();
  const strategy = _mode === 'force-dark' ? 'force-dark' : createColorSchemeSource('light');
  await visualColorSchemeStorage.setValue('light');
  function SchemeButton() {
    const visual = useVisual();
    return <button onClick={() => visual.setColorScheme('dark')}>dark preference</button>;
  }
  const view = render(
    <SurfaceProvider env={{ ...env, colorSchemeStrategy: strategy }}>
      <VisualManagerRegistry persistentState={{ direction: 'ltr', colorScheme: 'light', primaryColor: 'blue' }}>
        <SchemeButton />
      </VisualManagerRegistry>
    </SurfaceProvider>,
    { container: env.rootElement }
  );
  fireEvent.click(view.getByText('dark preference'));
  await waitFor(async () => expect(await visualColorSchemeStorage.getValue()).toBe('dark'));
  // The surface keeps showing its forced/external scheme.
  expect(env.rootElement.getAttribute('data-mantine-color-scheme')).toBe(visible);
});

it('catches up on preferences changed between the initial read and mount', async () => {
  const env = shadowEnv();
  // bootstrap read light/ltr/blue; another surface then changed all three.
  await visualColorSchemeStorage.setValue('dark');
  await visualDirectionStorage.setValue('rtl');
  await visualPrimaryColorStorage.setValue('red');
  const readScheme = vi.spyOn(visualColorSchemeStorage, 'getValue');
  onTestFinished(() => readScheme.mockRestore());
  function Probe() {
    const visual = useVisual();
    return <span data-testid="primary">{visual.primaryColor}</span>;
  }
  const view = render(
    <SurfaceProvider env={env}>
      <VisualManagerRegistry persistentState={{ direction: 'ltr', colorScheme: 'light', primaryColor: 'blue' }}>
        <Probe />
      </VisualManagerRegistry>
    </SurfaceProvider>,
    { container: env.rootElement }
  );
  await waitFor(() => expect(env.rootElement.getAttribute('data-mantine-color-scheme')).toBe('dark'));
  expect(env.rootElement.getAttribute('dir')).toBe('rtl');
  expect(view.getByTestId('primary').textContent).toBe('red');
  expect(readScheme).toHaveBeenCalledTimes(1);
});

it('a local change during the catch-up read wins over the read', async () => {
  const env = shadowEnv();
  let finish: (value: 'ltr') => void = () => {};
  const read = vi
    .spyOn(visualDirectionStorage, 'getValue')
    .mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)));
  function Toggle() {
    const visual = useVisual();
    return <button onClick={() => visual.setDirection('rtl')}>rtl</button>;
  }
  const view = render(
    <SurfaceProvider env={env}>
      <VisualManagerRegistry persistentState={{ direction: 'ltr', colorScheme: 'light', primaryColor: 'blue' }}>
        <Toggle />
      </VisualManagerRegistry>
    </SurfaceProvider>,
    { container: env.rootElement }
  );
  fireEvent.click(view.getByText('rtl'));
  await act(async () => finish('ltr'));
  expect(env.rootElement.getAttribute('dir')).toBe('rtl');
  read.mockRestore();
});

it('falls back safely when a stored primaryColor is invalid, missing, or inherited', () => {
  const env = shadowEnv();
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  function Probe() {
    return (
      <output>
        {useVisual().primaryColor} {useMantineTheme().primaryColor}
      </output>
    );
  }
  const invalidValues = ['#', '#xyz', '#12', 'legacyBrand', '', 'constructor', 42, null];
  try {
    for (const value of invalidValues) {
      const view = render(
        <SurfaceProvider env={env}>
          <VisualManagerRegistry
            persistentState={{ colorScheme: 'light', direction: 'ltr', primaryColor: value as string }}
          >
            <Probe />
          </VisualManagerRegistry>
        </SurfaceProvider>
      );
      expect(view.getByRole('status').textContent).toBe(`${DEFAULT_PRIMARY_COLOR} ${DEFAULT_PRIMARY_COLOR}`);
      view.unmount();
    }
    expect(resolvePrimaryColor('removed', 'also-removed').preference).toBe(DEFAULT_THEME.primaryColor);
    expect(warn).toHaveBeenCalledTimes(invalidValues.length + 1);
  } finally {
    warn.mockRestore();
  }
});

it('persists the displayed fallback when a new primary color is invalid', async () => {
  const env = shadowEnv();
  await visualPrimaryColorStorage.setValue('red');
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  function Probe() {
    const visual = useVisual();
    return <button onClick={() => visual.setPrimaryColor('removedPalette')}>{visual.primaryColor}</button>;
  }
  try {
    const view = render(
      <SurfaceProvider env={env}>
        <VisualManagerRegistry persistentState={{ colorScheme: 'light', direction: 'ltr', primaryColor: 'red' }}>
          <Probe />
        </VisualManagerRegistry>
      </SurfaceProvider>
    );
    fireEvent.click(view.getByRole('button', { name: 'red' }));
    expect(view.getByRole('button').textContent).toBe(DEFAULT_PRIMARY_COLOR);
    await waitFor(async () => expect(await visualPrimaryColorStorage.getValue()).toBe(DEFAULT_PRIMARY_COLOR));
  } finally {
    warn.mockRestore();
  }
});

it('configures shadow isolation defaults on ModalRoot, DrawerRoot, Affix, and FloatingWindow', () => {
  const env = shadowEnv();
  let theme!: ReturnType<typeof useMantineTheme>;
  function Probe() {
    theme = useMantineTheme();
    return null;
  }
  render(
    <SurfaceProvider env={env}>
      <MantineRegistry
        colorSchemeManager={testColorSchemeManager}
        colorScheme="light"
        direction="ltr"
        palette={resolvePrimaryColor('blue').theme}
        onDirectionChange={() => {}}
      >
        <Probe />
      </MantineRegistry>
    </SurfaceProvider>,
    { container: env.rootElement }
  );
  expect(theme.components.ModalRoot?.defaultProps).toMatchObject({ zIndex: Z_INDEX.modal, lockScroll: false });
  expect(theme.components.DrawerRoot?.defaultProps).toMatchObject({ zIndex: Z_INDEX.modal, lockScroll: false });
  expect(theme.components.Affix?.defaultProps).toMatchObject({ zIndex: Z_INDEX.modal });
  expect(theme.components.FloatingWindow?.defaultProps).toMatchObject({ zIndex: Z_INDEX.popover });
});

it('writes color scheme preference to storage once per change in extension mode', async () => {
  const env = shadowEnv();
  const write = vi.spyOn(visualColorSchemeStorage, 'setValue');
  function SchemeButton() {
    const visual = useVisual();
    return <button onClick={() => visual.setColorScheme('dark')}>dark</button>;
  }
  const view = render(
    <SurfaceProvider env={env}>
      <VisualManagerRegistry persistentState={{ direction: 'ltr', colorScheme: 'light', primaryColor: 'blue' }}>
        <SchemeButton />
      </VisualManagerRegistry>
    </SurfaceProvider>,
    { container: env.rootElement }
  );
  try {
    fireEvent.click(view.getByText('dark'));
    await waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(write).toHaveBeenCalledWith('dark');
  } finally {
    write.mockRestore();
  }
});

it('updates visual.setColorScheme when strategy changes from forced to extension without visual diff', () => {
  const env = shadowEnv();
  function SchemeButton() {
    const visual = useVisual();
    return <button onClick={() => visual.setColorScheme('dark')}>dark</button>;
  }
  const app = (strategy: SurfaceEnv['colorSchemeStrategy']) => (
    <SurfaceProvider env={{ ...env, colorSchemeStrategy: strategy }}>
      <VisualManagerRegistry persistentState={{ direction: 'ltr', colorScheme: 'light', primaryColor: 'blue' }}>
        <SchemeButton />
      </VisualManagerRegistry>
    </SurfaceProvider>
  );
  const view = render(app('force-light'), { container: env.rootElement });
  expect(env.rootElement.getAttribute('data-mantine-color-scheme')).toBe('light');

  // Active scheme remains 'light' across the strategy switch, so VisualContextProvider
  // must refresh when setColorScheme changes from direct persistence to Mantine's setter.
  view.rerender(app('extension'));
  fireEvent.click(view.getByText('dark'));
  expect(env.rootElement.getAttribute('data-mantine-color-scheme')).toBe('dark');
});

it.each(['force-dark', 'external source'] as const)(
  'toggles the saved preference independently of %s',
  async (strategy) => {
    const env = shadowEnv();
    env.colorSchemeStrategy = strategy === 'force-dark' ? strategy : createColorSchemeSource('dark');
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const matchMedia = vi
      .spyOn(window, 'matchMedia')
      .mockReturnValue({ ...media, matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    function Toggle() {
      const visual = useVisual();
      return <button onClick={visual.toggleColorScheme}>{visual.colorScheme}</button>;
    }
    try {
      const view = render(
        <SurfaceProvider env={env}>
          <VisualManagerRegistry persistentState={{ colorScheme: 'auto', direction: 'ltr', primaryColor: 'blue' }}>
            <Toggle />
          </VisualManagerRegistry>
        </SurfaceProvider>,
        { container: env.rootElement }
      );
      for (const [previous, next] of [
        ['auto', 'dark'],
        ['dark', 'light'],
        ['light', 'dark'],
      ] as const) {
        fireEvent.click(view.getByText(previous));
        await waitFor(async () => expect(await visualColorSchemeStorage.getValue()).toBe(next));
        expect(view.getByText(next)).toBeTruthy();
        expect(env.rootElement.getAttribute('data-mantine-color-scheme')).toBe('dark');
      }
    } finally {
      matchMedia.mockRestore();
    }
  }
);

it('keeps the latest local preference during and after delayed storage notifications', async () => {
  function control<T>(
    item: {
      watch: (cb: (next: T) => void) => () => void;
      getValue: () => Promise<T>;
      setValue: (next: T) => Promise<void>;
    },
    initial: T
  ) {
    let stored = initial;
    const callbacks = new Set<(next: T) => void>();
    const writes: (() => void)[] = [];
    vi.spyOn(item, 'watch').mockImplementation((cb) => {
      callbacks.add(cb);
      return () => {
        callbacks.delete(cb);
      };
    });
    vi.spyOn(item, 'getValue').mockImplementation(async () => stored);
    vi.spyOn(item, 'setValue').mockImplementation(
      (next) =>
        new Promise<void>((resolve) => {
          writes.push(() => {
            stored = next;
            resolve();
          });
        })
    );
    return {
      writes,
      notify: (next: T) => callbacks.forEach((cb) => cb(next)),
      remote: (next: T) => {
        stored = next;
        callbacks.forEach((cb) => cb(next));
      },
    };
  }
  const direction = control(visualDirectionStorage, 'ltr');
  const scheme = control(visualColorSchemeStorage, 'light');
  const primary = control(visualPrimaryColorStorage, 'blue');
  const env = shadowEnv();
  let visual!: ReturnType<typeof useVisual>;
  function Preferences() {
    visual = useVisual();
    return (
      <output>{[visual.direction, visual.primaryColor, visual.colorScheme, visual.activeColorScheme].join(' ')}</output>
    );
  }
  try {
    const view = render(
      <SurfaceProvider env={env}>
        <VisualManagerRegistry persistentState={{ colorScheme: 'light', direction: 'ltr', primaryColor: 'blue' }}>
          <Preferences />
        </VisualManagerRegistry>
      </SurfaceProvider>,
      { container: env.rootElement }
    );
    await act(async () => {});
    act(() => {
      visual.setDirection('rtl');
      visual.setPrimaryColor('red');
      visual.setColorScheme('dark');
    });
    act(() => {
      visual.setDirection('ltr');
      visual.setPrimaryColor('grape');
      visual.setColorScheme('light');
    });
    const notifyFirst = () => {
      direction.notify('rtl');
      scheme.notify('dark');
      primary.notify('red');
    };
    for (let write = 0; write < 2; write++) {
      await act(async () => {
        direction.writes[write]!();
        scheme.writes[write]!();
        primary.writes[write]!();
      });
      await act(async () => notifyFirst());
      expect(view.getByRole('status').textContent).toBe('ltr grape light light');
    }
    await act(async () => {
      direction.remote('rtl');
      scheme.remote('dark');
      primary.remote('teal');
    });
    expect(view.getByRole('status').textContent).toBe('rtl teal dark dark');
  } finally {
    cleanup();
    vi.restoreAllMocks();
  }
});
