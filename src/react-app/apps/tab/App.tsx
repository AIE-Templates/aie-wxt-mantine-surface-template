/**
 * Full-tab page surface. WXT bundles this entrypoint as an extension page at
 * `/tab.html` (open it with `browser.tabs.create({ url: 'tab.html' })`). Same
 * isomorphic shell as popup/sidepanel/options — only the mount point differs.
 */

import DemoPanel from '@/react-app/components/DemoPanel';

export default function TabApp() {
  return <DemoPanel surfaceLabel="tab" />;
}
