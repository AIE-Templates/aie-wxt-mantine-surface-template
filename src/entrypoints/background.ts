import { defineBackground } from '#imports';
import { onMessage } from '@/core/messaging';
import { registerEchoService } from '@/core/rpc/echo/impl';
import { PROJECT_PREFIX } from '@/constants';

export default defineBackground(() => {
  registerEchoService();

  onMessage('ping', ({ data }) => `pong:${data}`);

  console.log(`[${PROJECT_PREFIX}] background ready`, { id: browser.runtime.id });
});
