import { documentSurface } from '@/surface/document';
import OptionsApp from '@/react-app/apps/options/App';
import { renderSurfaceApp } from '@/react-app/bootstrap';

renderSurfaceApp(document.getElementById('root')!, documentSurface(), <OptionsApp />).catch((error) =>
  console.error('[options] failed to render the surface', error)
);
