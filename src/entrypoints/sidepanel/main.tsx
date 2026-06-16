import { documentSurface } from '@/surface/document';
import SidepanelApp from '@/react-app/apps/sidepanel/App';
import { renderSurfaceApp } from '@/react-app/bootstrap';

void renderSurfaceApp(document.getElementById('root')!, documentSurface(), <SidepanelApp />);
