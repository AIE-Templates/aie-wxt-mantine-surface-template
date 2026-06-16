import { Box } from '@mantine/core';
import DemoPanel from '@/react-app/components/DemoPanel';

export default function PopupApp() {
  return (
    <Box w={360}>
      <DemoPanel surfaceLabel="popup" />
    </Box>
  );
}
