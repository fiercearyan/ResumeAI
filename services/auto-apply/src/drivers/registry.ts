import type { ApplyDriver } from './types';
import { greenhouse } from './greenhouse';

export const drivers: ApplyDriver[] = [greenhouse];

export function pickDriver(url: string): ApplyDriver | null {
  for (const d of drivers) {
    if (d.canHandle(url)) return d;
  }
  return null;
}
