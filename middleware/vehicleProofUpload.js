import crypto from 'node:crypto';
import { open } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { fileURLToPath } from 'node:url';
import ApiError from '../utils/ApiError.js';
import { ensureVehicleProofDirectory, removeVehicleProofFiles } from '../utils/vehicleProofFiles.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const uploadDirectory = fileURLToPath(new URL('../uploads/vehicle-documents/', import.meta.url));

const storage = multer.diskStorage({
  destination: async (_req, _file, callback) => {
    try {
      await ensureVehicleProofDirectory();
      callback(null, path.resolve(uploadDirectory));
    } catch (error) {
      callback(error);
    }
  },
  filename: (_req, file, callback) => callback(null, `${crypto.randomUUID()}`),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: 6 },
  fileFilter: (_req, file, callback) => {
    if (!MIME_TYPES.has(file.mimetype)) {
      callback(new ApiError(400, 'Proof images must be JPG, PNG, or WebP files'));
      return;
    }
    callback(null, true);
  },
});

async function detectImageMimeType(file) {
  const handle = await open(file.path, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    const bytes = header.subarray(0, bytesRead);
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
    if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
    if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
    return null;
  } finally {
    await handle.close();
  }
}

function multerError(error) {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
    return new ApiError(400, 'Each proof image must be 5 MB or smaller');
  }
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_COUNT') {
    return new ApiError(400, 'You can upload proof images for up to 6 documents');
  }
  if (error instanceof multer.MulterError) return new ApiError(400, error.message);
  return error;
}

export default function uploadVehicleProofs(req, _res, next) {
  upload.array('proofs', 6)(req, _res, async (error) => {
    const files = req.files || [];
    try {
      if (error) throw multerError(error);
      for (const file of files) {
        if (await detectImageMimeType(file) !== file.mimetype) {
          throw new ApiError(400, 'A proof file is not a valid JPG, PNG, or WebP image');
        }
      }

      if (typeof req.body.payload === 'string') {
        try {
          req.body = JSON.parse(req.body.payload);
        } catch {
          throw new ApiError(400, 'Vehicle data is not valid JSON');
        }
      }
      next();
    } catch (caught) {
      try {
        await removeVehicleProofFiles(files);
      } catch (cleanupError) {
        next(cleanupError);
        return;
      }
      next(caught);
    }
  });
}
