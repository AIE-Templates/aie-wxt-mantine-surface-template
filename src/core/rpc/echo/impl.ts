import { registerService } from '@webext-core/proxy-service';
import { ECHO_SERVICE_KEY, type EchoService } from './contract';

class BackgroundEchoService implements EchoService {
  async echo(text: string): Promise<string> {
    return `[background] ${text}`;
  }
}

/** Import and register only in the background entrypoint. */
export function registerEchoService() {
  return registerService(ECHO_SERVICE_KEY, new BackgroundEchoService());
}
