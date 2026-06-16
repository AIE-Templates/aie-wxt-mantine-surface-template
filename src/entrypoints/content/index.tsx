import { defineContentScript } from '#imports';
import { createShadowSurfaceUi } from '@/surface/shadow';
import ContentApp from '@/react-app/apps/content/App';
import { renderSurfaceApp } from '@/react-app/bootstrap';
import { SHADOW_SURFACE_TAG } from '@/constants';
import './reset.css';

export default defineContentScript({
  matches: ['http://*/*', 'https://*/*'],
  cssInjectionMode: 'ui',
  async main(ctx) {
    const ui = await createShadowSurfaceUi(ctx, {
      name: SHADOW_SURFACE_TAG,
      onMount: (container, env) => renderSurfaceApp(container, env, <ContentApp />),
      onRemove: (mounted) => {
        void mounted?.then((root) => root.unmount());
      },
    });
    ui.mount();
  },
});
