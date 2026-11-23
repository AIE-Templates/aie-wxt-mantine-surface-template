import { documentSurface } from '@/surface/document';
import PopupApp from '@/react-app/apps/popup/App';
import { renderSurfaceApp } from '@/react-app/bootstrap';

renderSurfaceApp(document.getElementById('root')!, documentSurface(), <PopupApp />).catch((error) =>
  console.error('[popup] failed to render the surface', error)
);
