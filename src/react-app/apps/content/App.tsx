/**
 * @module apps/content
 *
 * In-page host surface demo: a fixed panel (the main plugin UI) plus
 * satellite controls that demonstrate component-level injection —
 * using shared stylesheets, portal context (opening a host Modal from a satellite),
 * and handling React events across shadow trees with proper lifecycle management.
 */

import { useRef, useState } from 'react';
import { Badge, Button, Group, Paper, Popover, Text, TextInput, Tooltip } from '@mantine/core';
import { modals } from '@mantine/modals';
import { createSatellite, type SatelliteHandle } from '@/surface/satellite';
import DemoPanel from '@/react-app/components/DemoPanel';

function SatelliteBadge({ index }: { index: number }) {
  const [clicks, setClicks] = useState(0);

  return (
    <Paper withBorder shadow="sm" p={6} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <Tooltip label="I am a satellite — shared sheets, no own provider stack">
        <Badge size="sm" variant="light">
          sat #{index}
        </Badge>
      </Tooltip>
      <Button size="compact-xs" variant="default" onClick={() => setClicks((c) => c + 1)}>
        clicks: {clicks}
      </Button>
      {/* Rich interactive content inside a satellite: an input (its keystrokes
          must not leak to host hotkeys) and a Popover (portals to the host
          surface but positions against this trigger). */}
      <TextInput size="xs" w={90} placeholder="sat input" />
      <Popover withArrow shadow="md" position="top">
        <Popover.Target>
          <Button size="compact-xs" variant="default">
            pop
          </Button>
        </Popover.Target>
        <Popover.Dropdown>
          <Text size="xs">satellite popover #{index}</Text>
        </Popover.Dropdown>
      </Popover>
      <Button
        size="compact-xs"
        onClick={() =>
          modals.openConfirmModal({
            title: `Opened from satellite #${index}`,
            children: <Text size="sm">Same React tree → host ModalsProvider, modal lands in the host surface.</Text>,
            labels: { confirm: 'OK', cancel: 'Cancel' },
          })
        }
      >
        host modal
      </Button>
    </Paper>
  );
}

export default function ContentApp() {
  const satellitesRef = useRef<SatelliteHandle[]>([]);

  const spawnSatellites = () => {
    const anchors = Array.from(document.querySelectorAll('p, h1, h2')).slice(0, 3);
    anchors.forEach((anchor, index) => {
      satellitesRef.current.push(createSatellite(anchor, <SatelliteBadge index={index} />));
    });
  };

  const destroySatellites = () => {
    satellitesRef.current.forEach((satellite) => satellite.destroy());
    satellitesRef.current = [];
  };

  return (
    <Paper
      withBorder
      shadow="lg"
      style={{ position: 'fixed', right: 16, bottom: 16, width: 360, zIndex: 'var(--aie-z-main-ui)' }}
    >
      <DemoPanel surfaceLabel="content" />
      <Group gap="xs" p="md" pt={0}>
        <Button size="xs" variant="outline" onClick={spawnSatellites}>
          spawn satellites
        </Button>
        <Button size="xs" variant="outline" color="red" onClick={destroySatellites}>
          destroy
        </Button>
      </Group>
    </Paper>
  );
}
