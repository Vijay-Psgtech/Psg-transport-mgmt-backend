import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads/vehicle-documents');

export async function ensureVehicleProofDirectory() {
  await mkdir(directory, { recursive: true });
}

export async function removeVehicleProofFiles(proofs) {
  await Promise.all(proofs.filter(Boolean).map(async ({ filename }) => {
    try {
      await unlink(path.join(directory, filename));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }));
}

export function vehicleProofPath(filename) {
  return path.join(directory, filename);
}
