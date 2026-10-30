import { createProxyService, type ProxyServiceKey } from '@webext-core/proxy-service';

/** Safe to import from any surface: no background implementation dependencies. */
export interface EchoService {
  echo(text: string): Promise<string>;
}

export const ECHO_SERVICE_KEY = 'EchoService' as ProxyServiceKey<EchoService>;

export function getEchoService() {
  return createProxyService(ECHO_SERVICE_KEY);
}
