/**
 * @module core/rpc/echo
 *
 * Demo proxy service (@webext-core/proxy-service v2): write a class once,
 * register it in the background, call it from any surface as if it were
 * local — the RPC transport is invisible. This is the standard channel for
 * anything that must run in the background (cross-origin fetches, downloads,
 * long-lived work).
 */

import { createProxyService, registerService, type ProxyServiceKey } from '@webext-core/proxy-service';

export class EchoService {
  async echo(text: string): Promise<string> {
    return `[background] ${text}`;
  }
}

/** Binds the service type to its key, so both ends stay in sync. */
const ECHO_SERVICE_KEY = 'EchoService' as ProxyServiceKey<EchoService>;

/** Call once from the background entrypoint. */
export function registerEchoService() {
  return registerService(ECHO_SERVICE_KEY, new EchoService());
}

/** Call from any surface/context; methods proxy to the background. */
export function getEchoService() {
  return createProxyService(ECHO_SERVICE_KEY);
}
