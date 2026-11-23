import { documentSurface } from '@/surface/document';
import SidepanelApp from '@/react-app/apps/sidepanel/App';
import { renderSurfaceApp } from '@/react-app/bootstrap';

renderSurfaceApp(document.getElementById('root')!, documentSurface(), <SidepanelApp />).catch((error) =>
  console.error('[sidepanel] failed to render the surface', error)
);
