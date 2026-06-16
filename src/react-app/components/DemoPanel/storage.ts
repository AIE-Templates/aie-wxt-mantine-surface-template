/**
 * Demo-only storage item backing the DemoPanel's persisted-note field, used to
 * showcase useExtStorage cross-surface live sync. Real projects define their
 * own items wherever they belong (cf. VisualManager/storages.ts).
 */

import { storage } from '#imports';
import { PROJECT_PREFIX } from '@/constants';

export const demoNoteStorage = storage.defineItem<string>(`local:${PROJECT_PREFIX}:demo:note`, { fallback: '' });
