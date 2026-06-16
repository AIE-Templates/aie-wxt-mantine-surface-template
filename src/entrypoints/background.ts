import { defineBackground } from '#imports';
import { onMessage } from '@/core/messaging';
import { registerEchoService } from '@/core/rpc/echo';

export default defineBackground(() => {
  registerEchoService();

  onMessage('ping', ({ data }) => `pong:${data}`);

  console.log('[aie] background ready', { id: browser.runtime.id });
});
