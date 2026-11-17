import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads/driver-licenses');

export async function ensureDriverLicenseDirectory() {
  await mkdir(directory, { recursive: true });
}

export async function removeDriverLicenseFiles(files) {
  await Promise.all(files.filter(Boolean).map(async ({ filename }) => {
    try {
      await unlink(path.join(directory, filename));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }));
}

export function driverLicensePath(filename) {
  return path.join(directory, filename);
}
