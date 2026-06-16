import { defineBackground } from '#imports';
import { PROJECT_PREFIX } from '@/constants';
import { onMessage } from '@/core/messaging';
import { registerEchoService } from '@/core/rpc/echo';

export default defineBackground(() => {
  registerEchoService();

  onMessage('ping', ({ data }) => `pong:${data}`);

  console.log(`[${PROJECT_PREFIX}] background ready`, { id: browser.runtime.id });
});
