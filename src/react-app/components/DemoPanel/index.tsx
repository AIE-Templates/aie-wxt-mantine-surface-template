/**
 * @module components/DemoPanel
 *
 * The isomorphism showcase: this exact component is mounted in popup,
 * sidepanel, options, tab AND the in-page shadow surface, and exercises every
 * cross-surface capability — color scheme sync, primary color, portals
 * (Modal/Popover/Notifications), prefixed Tailwind utilities (@property),
 * event isolation (text input), reactive storage and both communication layers.
 */

import { useState } from 'react';
import {
  Badge,
  Button,
  ColorSwatch,
  Drawer,
  Group,
  HoverCard,
  Menu,
  Popover,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { sendMessage } from '@/core/messaging';
import { getEchoService } from '@/core/rpc/echo';
import { useExtStorage } from '@/react-app/hooks/useExtStorage';
import { useVisual } from '@/react-app/managers/VisualManager/context';
import type { VisualColorScheme } from '@/react-app/managers/VisualManager/defs';
import { demoNoteStorage } from './storage';
import classes from './styles.module.scss';

const PRIMARY_CHOICES = ['blue', 'grape', 'teal', 'orange'];

export default function DemoPanel({ surfaceLabel }: { surfaceLabel: string }) {
  const visual = useVisual();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Persisted across reloads AND live-synced to every other surface — type in
  // the popup, watch it appear in the sidepanel. Same primitive any feature
  // toggle / setting would use.
  const [note, setNote] = useExtStorage(demoNoteStorage);

  return (
    <Stack gap="sm" p="md" className={classes.panel}>
      <Group justify="space-between">
        <Text fw={600}>AIE Surface Demo</Text>
        <Badge variant="light">{surfaceLabel}</Badge>
      </Group>

      <SegmentedControl
        size="xs"
        fullWidth
        value={visual.colorScheme}
        onChange={(value) => visual.setColorScheme(value as VisualColorScheme)}
        data={['light', 'dark', 'auto']}
      />

      <Group gap="xs">
        {PRIMARY_CHOICES.map((color) => (
          <ColorSwatch
            key={color}
            size={20}
            color={`var(--mantine-color-${color}-6)`}
            onClick={() => visual.setPrimaryColor(color)}
            style={{ cursor: 'pointer' }}
          />
        ))}
        <Text size="xs" c="dimmed">
          primary: {visual.primaryColor}
        </Text>
      </Group>

      {/* ring/shadow/rotate depend on Tailwind's internal variables — after
          the postcss rename these must work via --aie-tw-* (@property). */}
      <div className="flex items-center gap-2">
        <div className="size-6 rotate-12 rounded bg-amber-400 shadow-lg ring-2 ring-blue-500" />
        <span className="text-xs opacity-70">tailwind ring / shadow / rotate</span>
      </div>

      <TextInput size="xs" placeholder="type here — host hotkeys must NOT fire" />

      <TextInput
        size="xs"
        label="persisted note (syncs to every surface)"
        placeholder="type — survives reload, appears in other surfaces"
        value={note}
        onChange={(event) => setNote(event.currentTarget.value)}
      />

      <Group gap="xs">
        <Button
          size="xs"
          onClick={() =>
            modals.openConfirmModal({
              title: `Modal in ${surfaceLabel}`,
              children: <Text size="sm">I render inside this surface&apos;s portal target.</Text>,
              labels: { confirm: 'OK', cancel: 'Cancel' },
            })
          }
        >
          Modal
        </Button>
        <Button size="xs" variant="light" onClick={() => notifications.show({ message: `Hello from ${surfaceLabel}` })}>
          Notify
        </Button>
        <Popover withArrow shadow="md">
          <Popover.Target>
            <Button size="xs" variant="default">
              Popover
            </Button>
          </Popover.Target>
          <Popover.Dropdown>
            <Text size="xs">portal-scoped dropdown</Text>
          </Popover.Dropdown>
        </Popover>
      </Group>

      {/* Overlay components that also portal — must stay inside the surface. */}
      <Group gap="xs">
        <Tooltip label="portal-scoped tooltip" withArrow>
          <Button size="xs" variant="default">
            Tooltip
          </Button>
        </Tooltip>
        <Menu shadow="md" withArrow>
          <Menu.Target>
            <Button size="xs" variant="default">
              Menu
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>portal-scoped menu</Menu.Label>
            <Menu.Item>First item</Menu.Item>
            <Menu.Item>Second item</Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <Button size="xs" variant="default" onClick={() => setDrawerOpen(true)}>
          Drawer
        </Button>
        <Drawer opened={drawerOpen} onClose={() => setDrawerOpen(false)} title={`Drawer in ${surfaceLabel}`} size="xs">
          <Text size="sm">I render inside this surface and must not lock the host body.</Text>
        </Drawer>
      </Group>

      {/* Combobox family + HoverCard — same floating mechanism as Popover, so
          their dropdowns must also clear the panel they open from. Select
          stands in for MultiSelect/Autocomplete/TagsInput (shared Combobox). */}
      <Group gap="xs">
        <HoverCard withArrow shadow="md" position="top">
          <HoverCard.Target>
            <Button size="xs" variant="default">
              HoverCard
            </Button>
          </HoverCard.Target>
          <HoverCard.Dropdown>
            <Text size="xs">portal-scoped hover card</Text>
          </HoverCard.Dropdown>
        </HoverCard>
        <Select
          size="xs"
          placeholder="Select (Combobox)"
          comboboxProps={{ withinPortal: true }}
          data={['Alpha', 'Beta', 'Gamma', 'Delta']}
          w={160}
        />
      </Group>

      <Group gap="xs">
        <Button
          size="xs"
          variant="subtle"
          onClick={async () => notifications.show({ message: await sendMessage('ping', surfaceLabel) })}
        >
          messaging.ping
        </Button>
        <Button
          size="xs"
          variant="subtle"
          onClick={async () => notifications.show({ message: await getEchoService().echo(surfaceLabel) })}
        >
          rpc.echo
        </Button>
      </Group>
    </Stack>
  );
}
