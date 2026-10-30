import { createTheme, Modal } from '@mantine/core';
import { DEFAULT_PRIMARY_COLOR } from './theme-defaults';

/** Application-owned tokens/defaults. Surface isolation overrides merge last. */
export const appTheme = createTheme({
  primaryColor: DEFAULT_PRIMARY_COLOR,
  focusRing: 'auto',
  components: {
    Modal: Modal.extend({ defaultProps: { centered: true } }),
  },
});
