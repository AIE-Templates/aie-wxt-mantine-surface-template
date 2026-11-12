/* eslint-disable no-restricted-syntax -- Tests inspect the host document to prove surface isolation. */
import { Portal, useDirection, useMantineTheme, virtualColor } from '@mantine/core';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { followHostColorScheme } from '@/surface/addons/host-scheme';
import { createColorSchemeSource } from '@/surface/color-scheme';
import { SurfaceProvider } from '@/surface/context';
import type { SurfaceEnv } from '@/surface/defs';
import { documentSurface } from '@/surface/document';
import { createSatellite, SatelliteOutlet } from '@/surface/satellite';
import { SURFACE_ROOT_CLASS } from '@/constants';
import { useVisual } from '../context';
import VisualManagerRegistry from '../registry';
import { visualDirectionStorage } from '../storages';
import MantineRegistry from './MantineRegistry';

vi.mock('@/react-app/theme', async () => {
  const { appTheme } = await vi.importActual<typeof import('@/react-app/theme')>('@/react-app/theme');
  return {
    appTheme: {
      ...appTheme,
      fontFamily: 'Example Sans',
      primaryShade: 5,
      colors: { brand: virtualColor({ name: 'brand', light: 'blue', dark: 'cyan' }) },
      components: {
        ...appTheme.components,
        Portal: { defaultProps: { target: 'body' } },
        Modal: { defaultProps: { centered: true, lockScroll: true } },
      },
    },
  };
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
  const app = (strategy: SurfaceEnv['colorSchemeStrategy']) => (
    <SurfaceProvider env={{ ...env, colorSchemeStrategy: strategy }}>
      <MantineRegistry colorScheme="auto" direction="ltr" primaryColor="blue" onDirectionChange={() => {}} />
    </SurfaceProvider>
  );
  const view = render(app(first), { container: env.rootElement });
  expect(env.rootElement.getAttribute('data-mantine-color-scheme')).toBe('light');
  act(() => first.set('dark'));
  expect(env.rootElement.getAttribute('data-mantine-color-scheme')).toBe('dark');
  view.rerender(app(second));
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
      <MantineRegistry colorScheme="dark" direction="ltr" primaryColor="blue" onDirectionChange={() => {}} />
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
      <MantineRegistry colorScheme="light" direction="ltr" primaryColor={primaryColor} onDirectionChange={() => {}}>
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
  view.rerender(app('#ff0000'));
  expect(theme.primaryColor).toBe('primary');
  expect(theme.colors.primary).toHaveLength(10);
});

it('sets direction on an owned document and restores its original attribute on unmount', () => {
  document.documentElement.setAttribute('dir', 'rtl');
  const env = documentSurface();
  const view = render(
    <SurfaceProvider env={env}>
      <MantineRegistry colorScheme="light" direction="ltr" primaryColor="blue" onDirectionChange={() => {}} />
    </SurfaceProvider>
  );
  expect(document.documentElement.getAttribute('dir')).toBe('ltr');
  view.unmount();
  expect(document.documentElement.getAttribute('dir')).toBe('rtl');
});
