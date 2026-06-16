import { documentSurface } from '@/surface/document';
import PopupApp from '@/react-app/apps/popup/App';
import { renderSurfaceApp } from '@/react-app/bootstrap';

void renderSurfaceApp(document.getElementById('root')!, documentSurface(), <PopupApp />);
