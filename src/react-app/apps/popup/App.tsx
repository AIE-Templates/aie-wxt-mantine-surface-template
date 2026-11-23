import { useEffect, useState } from 'react';
import { Box, Button, Group, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { browser } from '#imports';
import DemoPanel from '@/react-app/components/DemoPanel';

type SidePanelState =
  | { status: 'ready'; windowId?: number }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'unavailable' };

export default function PopupApp() {
  const sidebarAction = (browser as { sidebarAction?: { open?: () => Promise<void> } }).sidebarAction;
  const hasSidebarAction = typeof sidebarAction?.open === 'function';
  const hasSidePanel = typeof browser.sidePanel?.open === 'function';

  // Wait for the current window ID before enabling Chrome's button so clicking
  // it always invokes browser.sidePanel.open() synchronously inside the user gesture.
  const [sidePanel, setSidePanel] = useState<SidePanelState>(() =>
    hasSidebarAction ? { status: 'ready' } : hasSidePanel ? { status: 'loading' } : { status: 'unavailable' }
  );
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (hasSidebarAction || !hasSidePanel) return;
    let active = true;
    void (browser.windows?.getCurrent?.() ?? Promise.reject(new Error('Windows API is unavailable.')))
      .then((win) => {
        if (!active) return;
        if (win.id !== undefined) {
          setSidePanel({ status: 'ready', windowId: win.id });
        } else {
          setSidePanel({ status: 'error', message: 'Unable to determine current window ID.' });
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setSidePanel({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to determine current window ID.',
        });
      });
    return () => {
      active = false;
    };
  }, [hasSidebarAction, hasSidePanel, retryCount]);

  const onSidePanelClick = async () => {
    if (sidePanel.status === 'error') {
      setSidePanel({ status: 'loading' });
      setRetryCount((count) => count + 1);
      return;
    }
    if (sidePanel.status !== 'ready') return;
    try {
      // Firefox's sidebarAction.open() requires the synchronous user-gesture turn
      // (no await beforehand), whereas Chrome's sidePanel.open() accepts a windowId.
      if (sidebarAction?.open) {
        await sidebarAction.open();
        return;
      }
      if (browser.sidePanel?.open && sidePanel.windowId !== undefined) {
        await browser.sidePanel.open({ windowId: sidePanel.windowId });
        return;
      }
      throw new Error('Side panel API is unavailable in this browser.');
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const openTab = async () => {
    try {
      await browser.tabs.create({ url: browser.runtime.getURL('/tab.html') });
    } catch (error) {
      notifications.show({
        color: 'red',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <Box w={360}>
      <DemoPanel surfaceLabel="popup" />
      <Group gap="xs" p="md" pt={0}>
        <Button
          size="xs"
          variant="outline"
          disabled={sidePanel.status === 'loading' || sidePanel.status === 'unavailable'}
          onClick={onSidePanelClick}
        >
          {sidePanel.status === 'error' ? 'Retry side panel' : 'Open side panel'}
        </Button>
        <Button size="xs" variant="outline" onClick={openTab}>
          Open tab
        </Button>
      </Group>
      {sidePanel.status === 'error' && (
        <Text size="xs" c="red" px="md" pb="xs">
          {sidePanel.message}
        </Text>
      )}
    </Box>
  );
}
