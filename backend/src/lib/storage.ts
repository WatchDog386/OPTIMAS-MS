import { promises as fs } from 'fs';
import path from 'path';
import { env } from '../config/env';

/**
 * Storage adapter. Photos are written to local disk under UPLOAD_DIR.
 * Swap this implementation for S3 / Cloudflare R2 in production — callers only use `save` and `absolutePath`.
 */
const root = path.resolve(env.UPLOAD_DIR);

export const storage = {
  async save(key: string, data: Buffer): Promise<string> {
    const full = path.join(root, key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return key;
  },
  absolutePath(key: string): string {
    const full = path.resolve(root, key);
    if (!full.startsWith(root + path.sep)) throw new Error('Invalid storage key');
    return full;
  },
};
