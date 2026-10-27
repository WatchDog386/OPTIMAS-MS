import type { Task } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { drivingRoute, geocode } from '../../lib/routing';
import { positionsOf, trailOf } from './location.service';

/**
 * Everything needed to follow a technician to a job: where the job is, where the technician is (and the
 * path they have driven), and the road route with distance and arrival time between the two.
 */
export async function trackJob(task: Pick<Task, 'id' | 'code' | 'title' | 'status' | 'address' | 'lat' | 'lng' | 'assigneeId' | 'customerName' | 'startedAt'>) {
  const assignee = await prisma.user.findUniqueOrThrow({ where: { id: task.assigneeId }, select: { id: true, name: true, phone: true } });
  const job = { id: task.id, code: task.code, title: task.title, status: task.status, address: task.address, customerName: task.customerName, lat: task.lat, lng: task.lng, startedAt: task.startedAt };
  // Following only makes sense until the work starts
  const moving = task.status === 'ASSIGNED';
  const pos = (await positionsOf([assignee.id])).get(assignee.id) ?? null;
  const tech = { ...assignee, position: pos ? { ...pos, at: pos.at.toISOString() } : null };
  if (!moving || !pos || task.lat == null || task.lng == null) return { job, tech, trail: pos ? await trailOf(assignee.id) : [], route: null };
  const [trail, route] = await Promise.all([trailOf(assignee.id), drivingRoute([pos.lat, pos.lng], [task.lat, task.lng])]);
  return { job, tech, trail, route: { ...route, arriveAt: new Date(Date.now() + route.duration * 1000).toISOString() } };
}

/** Looks up coordinates for a job that only has a typed address (in the background; never throws). */
export async function fillJobCoordinates(taskId: string, address: string) {
  const hit = await geocode(address);
  if (hit) await prisma.task.updateMany({ where: { id: taskId, lat: null }, data: hit }).catch(() => undefined);
}
