import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { CapturePurpose } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { storage } from '../../lib/storage';
import { badRequest, forbidden, notFound } from '../../lib/http-error';
import { ah } from '../../middleware/async';
import { ROLES, me } from '../../middleware/auth';
import { parse } from '../../middleware/validate';
import { acceptCapture, issueChallenge } from './capture.service';

export const captureRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_PHOTO_MB * 1024 * 1024, files: 1 },
});

const challengeSchema = z.object({
  purpose: z.enum(CapturePurpose),
  taskId: z
    .string()
    .nullish()
    .transform((v) => v ?? undefined),
});

captureRouter.post(
  '/challenge',
  ah(async (req, res) => {
    const { purpose, taskId } = parse(challengeSchema, req.body);
    res.status(201).json(await issueChallenge(me(req).id, purpose, taskId));
  }),
);

const optionalNum = z.preprocess((v) => (v === '' || v === undefined ? undefined : Number(v)), z.number().finite().optional());

const uploadSchema = z.object({
  challengeId: z.string().min(1),
  nonce: z.string().min(1),
  lat: optionalNum.pipe(z.number().min(-90).max(90).optional()),
  lng: optionalNum.pipe(z.number().min(-180).max(180).optional()),
  accuracyM: optionalNum,
  deviceId: z.string().max(128).optional(),
  deviceTime: z.coerce.date().optional(),
});

captureRouter.post(
  '/upload',
  upload.single('photo'),
  ah(async (req, res) => {
    if (!req.file) throw badRequest('Photo is required', 'PHOTO_REQUIRED');
    const body = parse(uploadSchema, req.body);
    res.status(201).json(await acceptCapture(me(req).id, req.file.buffer, body));
  }),
);

/** Stream a stored photo. Owners can see their own; supervisors and storekeepers can see all. */
captureRouter.get(
  '/photos/:id',
  ah(async (req, res) => {
    const photo = await prisma.photo.findUnique({ where: { id: req.params.id } });
    if (!photo) throw notFound('Photo');
    const user = me(req);
    if (photo.userId !== user.id && !ROLES.STORE.includes(user.role)) throw forbidden();
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.sendFile(storage.absolutePath(photo.storageKey));
  }),
);
