import { documentSurface } from '@/surface/document';
import TabApp from '@/react-app/apps/tab/App';
import { renderSurfaceApp } from '@/react-app/bootstrap';

renderSurfaceApp(document.getElementById('root')!, documentSurface(), <TabApp />).catch((error) =>
  console.error('[tab] failed to render the surface', error)
);
