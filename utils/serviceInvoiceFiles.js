import { mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../uploads/service-invoices');

export async function ensureServiceInvoiceDirectory() {
  await mkdir(directory, { recursive: true });
}

export async function removeServiceInvoiceFile(filename) {
  if (!filename) return;
  try {
    await unlink(path.join(directory, filename));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export function serviceInvoicePath(filename) {
  return path.join(directory, filename);
}
