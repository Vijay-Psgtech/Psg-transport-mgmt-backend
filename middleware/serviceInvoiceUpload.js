import crypto from 'node:crypto';
import { open } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import ApiError from '../utils/ApiError.js';
import { ensureServiceInvoiceDirectory, removeServiceInvoiceFile } from '../utils/serviceInvoiceFiles.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const uploadDirectory = fileURLToPath(new URL('../uploads/service-invoices/', import.meta.url));

const upload = multer({
  storage: multer.diskStorage({
    destination: async (_req, _file, callback) => {
      try {
        await ensureServiceInvoiceDirectory();
        callback(null, path.resolve(uploadDirectory));
      } catch (error) {
        callback(error);
      }
    },
    filename: (_req, _file, callback) => callback(null, crypto.randomUUID()),
  }),
  limits: { fileSize: MAX_FILE_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype !== 'application/pdf' || path.extname(file.originalname).toLowerCase() !== '.pdf') {
      callback(new ApiError(400, 'Invoice must be a PDF file'));
      return;
    }
    callback(null, true);
  },
});

async function isPdf(file) {
  const handle = await open(file.path, 'r');
  try {
    const header = Buffer.alloc(5);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return bytesRead === header.length && header.toString('ascii') === '%PDF-';
  } finally {
    await handle.close();
  }
}

function multerError(error) {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return new ApiError(400, 'Invoice PDF must be 10 MB or smaller');
  }
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_COUNT') {
    return new ApiError(400, 'Upload one invoice PDF at a time');
  }
  if (error instanceof multer.MulterError) return new ApiError(400, error.message);
  return error;
}

export default function uploadServiceInvoice(req, _res, next) {
  upload.single('invoice')(req, _res, async (error) => {
    try {
      if (error) throw multerError(error);
      if (req.file && !(await isPdf(req.file))) throw new ApiError(400, 'Invoice file is not a valid PDF');
      if (typeof req.body.payload !== 'string') throw new ApiError(400, 'Service record data is required');
      try {
        req.body = JSON.parse(req.body.payload);
      } catch {
        throw new ApiError(400, 'Service record data is not valid JSON');
      }
      next();
    } catch (caught) {
      try {
        if (req.file) await removeServiceInvoiceFile(req.file.filename);
      } catch (cleanupError) {
        next(cleanupError);
        return;
      }
      next(caught);
    }
  });
}
