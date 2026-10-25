import crypto from 'crypto';
import type { CapturePurpose, Prisma } from '@prisma/client';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { storage } from '../../lib/storage';
import { distanceMetres } from '../../lib/geo';
import { badRequest, conflict, forbidden, notFound } from '../../lib/http-error';

/** A photo must be used by its action within this window after upload. */
const PHOTO_USE_WINDOW_MS = 10 * 60_000;

export async function issueChallenge(userId: string, purpose: CapturePurpose, taskId?: string) {
  const nonce = crypto.randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + env.CAPTURE_TTL_SECONDS * 1000);
  const challenge = await prisma.captureChallenge.create({ data: { userId, purpose, taskId, nonce, expiresAt } });
  return { challengeId: challenge.id, nonce, purpose, expiresAt };
}

const isJpeg = (buf: Buffer) => buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;

export interface CaptureInput {
  challengeId: string;
  nonce: string;
  lat?: number;
  lng?: number;
  accuracyM?: number;
  deviceId?: string;
  deviceTime?: Date;
}

/**
 * Verifies a live camera capture against its challenge and stores it.
 * Rejects expired/reused challenges, non-JPEG payloads and byte-identical re-uploads.
 */
export async function acceptCapture(userId: string, file: Buffer, input: CaptureInput) {
  const challenge = await prisma.captureChallenge.findUnique({ where: { id: input.challengeId } });
  if (!challenge || challenge.userId !== userId) throw notFound('Capture session');
  const expected = Buffer.from(challenge.nonce);
  const given = Buffer.from(input.nonce);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    throw forbidden('Capture session mismatch');
  }
  if (challenge.usedAt) throw conflict('This capture session was already used. Take a new photo.', 'CHALLENGE_USED');
  if (challenge.expiresAt < new Date()) throw badRequest('Capture session expired. Take a new photo.', 'CHALLENGE_EXPIRED');
  if (!isJpeg(file)) throw badRequest('Only photos taken with the in-app camera are accepted', 'INVALID_IMAGE');

  const sha256 = crypto.createHash('sha256').update(file).digest('hex');
  const duplicate = await prisma.photo.findUnique({ where: { sha256 } });
  if (duplicate) throw conflict('This photo has already been submitted before. Take a new one.', 'DUPLICATE_PHOTO');

  const flags: string[] = [];
  const hasLocation = input.lat !== undefined && input.lng !== undefined;
  if (!hasLocation) flags.push('NO_LOCATION');
  if (input.accuracyM !== undefined && input.accuracyM > env.MIN_GPS_ACCURACY_M) flags.push('LOW_GPS_ACCURACY');
  if (input.deviceTime && Math.abs(input.deviceTime.getTime() - Date.now()) > 5 * 60_000) flags.push('DEVICE_CLOCK_SKEW');

  const atOffice = challenge.purpose === 'CHECK_IN' || challenge.purpose === 'CHECK_OUT';
  if (atOffice && hasLocation && env.OFFICE_LAT !== undefined && env.OFFICE_LNG !== undefined) {
    const d = distanceMetres(input.lat!, input.lng!, env.OFFICE_LAT, env.OFFICE_LNG);
    if (d > env.OFFICE_RADIUS_M) flags.push('OUTSIDE_GEOFENCE');
  }

  const now = new Date();
  const key = `${challenge.purpose.toLowerCase()}/${now.toISOString().slice(0, 10)}/${userId}-${challenge.id}.jpg`;
  await storage.save(key, file);

  const [photo] = await prisma.$transaction([
    prisma.photo.create({
      data: {
        userId,
        purpose: challenge.purpose,
        challengeId: challenge.id,
        storageKey: key,
        sha256,
        sizeBytes: file.length,
        lat: input.lat,
        lng: input.lng,
        accuracyM: input.accuracyM,
        deviceId: input.deviceId,
        deviceTime: input.deviceTime,
        flags,
      },
    }),
    prisma.captureChallenge.update({ where: { id: challenge.id }, data: { usedAt: now } }),
  ]);

  return { photoId: photo.id, purpose: photo.purpose, receivedAt: photo.receivedAt, flags };
}

/**
 * Marks a verified photo as used by an action (check-in, task start …). Each photo may be consumed once,
 * only by its owner, only for the purpose it was captured for, and only shortly after capture.
 */
export async function consumePhoto(
  tx: Prisma.TransactionClient,
  photoId: string,
  userId: string,
  purpose: CapturePurpose,
  taskId?: string,
) {
  const photo = await tx.photo.findUnique({ where: { id: photoId }, include: { challenge: true } });
  if (!photo || photo.userId !== userId) throw badRequest('Photo not found — please retake it', 'PHOTO_INVALID');
  if (photo.purpose !== purpose) throw badRequest('This photo was taken for a different step', 'PHOTO_WRONG_PURPOSE');
  if (taskId && photo.challenge.taskId && photo.challenge.taskId !== taskId) {
    throw badRequest('This photo was taken for a different task', 'PHOTO_WRONG_TASK');
  }
  if (photo.consumedAt) throw conflict('This photo has already been used', 'PHOTO_USED');
  if (Date.now() - photo.receivedAt.getTime() > PHOTO_USE_WINDOW_MS) {
    throw badRequest('Photo is too old — please retake it', 'PHOTO_STALE');
  }
  return tx.photo.update({ where: { id: photoId }, data: { consumedAt: new Date() } });
}
