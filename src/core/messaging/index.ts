/**
 * @module core/messaging
 *
 * Typed runtime messaging (@webext-core/messaging). Add one entry to
 * ProtocolMap per message; both ends get full type safety — no string
 * actions, no hand-rolled listeners.
 *
 * For main-world ⇆ content-script bridging, see the README recipe
 * (@webext-core/messaging/page — same protocol style, different transport).
 */

import { defineExtensionMessaging } from '@webext-core/messaging';

interface ProtocolMap {
  /** Demo: round-trip a string through the background. */
  ping(data: string): string;
}

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
