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
  offline: z.preprocess((v) => v === '1' || v === 'true' || v === true, z.boolean()).optional(),
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
/**
 * Who may open a photo: the person who took it and supervisors/admins. The store sees job photos (they
 * show installed devices) but not staff check-in/out selfies, which it has no need for.
 */
function canSee(role: string, userId: string, photo: { userId: string; purpose: string }) {
  if (photo.userId === userId || ROLES.MANAGERS.includes(role as never)) return true;
  return role === 'STOREKEEPER' && photo.purpose.startsWith('TASK_');
}

captureRouter.get(
  '/photos/:id',
  ah(async (req, res) => {
    const photo = await prisma.photo.findUnique({ where: { id: req.params.id } });
    if (!photo) throw notFound('Photo');
    const user = me(req);
    if (!canSee(user.role, user.id, photo)) throw forbidden();
    res.setHeader('Cache-Control', 'private, max-age=86400');
    res.sendFile(storage.absolutePath(photo.storageKey));
  }),
);

/** Everything known about a photo: who, when (phone and server time), where, how accurate, and what it was for. */
captureRouter.get(
  '/photos/:id/info',
  ah(async (req, res) => {
    const photo = await prisma.photo.findUnique({
      where: { id: req.params.id },
      include: {
        user: { select: { id: true, name: true, staffNo: true } },
        attendanceIn: { select: { id: true } },
        attendanceOut: { select: { id: true } },
        taskStart: { select: { id: true, code: true, title: true } },
        taskEnd: { select: { id: true, code: true, title: true } },
      },
    });
    if (!photo) throw notFound('Photo');
    const user = me(req);
    if (!canSee(user.role, user.id, photo)) throw forbidden();
    const task = photo.taskStart ?? photo.taskEnd;
    res.json({
      photo: {
        id: photo.id,
        purpose: photo.purpose,
        receivedAt: photo.receivedAt,
        deviceTime: photo.deviceTime,
        lat: photo.lat,
        lng: photo.lng,
        accuracyM: photo.accuracyM,
        deviceId: photo.deviceId,
        sizeBytes: photo.sizeBytes,
        flags: photo.flags,
        user: photo.user,
        usedFor: task ? { kind: 'TASK', id: task.id, code: task.code, title: task.title } : photo.attendanceIn ?? photo.attendanceOut ? { kind: 'ATTENDANCE', id: (photo.attendanceIn ?? photo.attendanceOut)!.id } : null,
      },
    });
  }),
);
