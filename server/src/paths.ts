import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const candidates = [
  path.resolve(process.cwd(), 'data'),
  path.resolve(process.cwd(), 'server', 'data'),
  path.resolve(moduleDirectory, '../data'),
];
export const DATA_DIR = candidates.find((candidate) => existsSync(path.join(candidate, 'templates'))) ?? candidates[0];
