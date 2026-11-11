import crypto from 'node:crypto';
import { mkdir, rename, unlink } from 'node:fs/promises';
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

export async function storeServiceInvoiceFile(file, registrationNumber, recordId) {
  const safeRegistration = registrationNumber.replace(/[^A-Z0-9-]/gi, '').toUpperCase();
  if (!safeRegistration) throw new Error('Vehicle registration number cannot be used in invoice filename');
  const filename = `${safeRegistration}_invoice_${recordId}.pdf`;
  await rename(file.path, path.join(directory, filename));
  return filename;
}

export function serviceInvoicePath(filename) {
  return path.join(directory, filename);
}
