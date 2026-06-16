import { documentSurface } from '@/surface/document';
import TabApp from '@/react-app/apps/tab/App';
import { renderSurfaceApp } from '@/react-app/bootstrap';

void renderSurfaceApp(document.getElementById('root')!, documentSurface(), <TabApp />);
