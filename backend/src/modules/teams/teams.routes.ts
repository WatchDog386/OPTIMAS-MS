import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { badRequest, conflict, notFound } from '../../lib/http-error';
import { audit } from '../../lib/audit';
import { ah } from '../../middleware/async';
import { ROLES, me, requireRole } from '../../middleware/auth';
import { parse } from '../../middleware/validate';

/**
 * Teams: a named crew of technicians that can take a job together. The leader is the job's assignee —
 * they start it and file the report for everyone; the other members see the job and get its alerts.
 */
export const teamsRouter = Router();

const person = { select: { id: true, name: true, staffNo: true, phone: true } } as const;
export const teamInclude = {
  leader: person,
  members: { include: { user: person }, orderBy: { user: { name: 'asc' } } },
} satisfies Prisma.TeamInclude;

export const newTeamSchema = z.object({
  name: z.string().trim().min(1, 'Give the team a name or number').max(60),
  memberIds: z.array(z.string().min(1)).min(2, 'A team needs at least two technicians').max(20),
  leaderId: z.string().min(1, 'Choose the team leader'),
});
export type NewTeam = z.infer<typeof newTeamSchema>;

/** Checks the people and creates the team (inside the caller's transaction). */
export async function createTeam(tx: Prisma.TransactionClient, input: NewTeam, createdById: string) {
  const memberIds = [...new Set(input.memberIds)];
  if (memberIds.length < 2) throw badRequest('A team needs at least two technicians');
  if (!memberIds.includes(input.leaderId)) throw badRequest('The leader must be one of the team members');
  const techs = await tx.user.findMany({ where: { id: { in: memberIds }, role: 'TECHNICIAN', active: true }, select: { id: true } });
  if (techs.length !== memberIds.length) throw badRequest('Teams can only include active technicians');
  const clash = await tx.team.findFirst({ where: { name: { equals: input.name, mode: 'insensitive' } } });
  if (clash) throw conflict(`There is already a team called "${clash.name}". Choose it from the list or use another name.`, 'TEAM_EXISTS');
  const team = await tx.team.create({
    data: { name: input.name, leaderId: input.leaderId, createdById, members: { create: memberIds.map((userId) => ({ userId })) } },
    include: teamInclude,
  });
  // Every team gets a group chat (supervisors and admins can read and reply too)
  await tx.conversation.create({ data: { kind: 'TEAM', teamId: team.id, title: team.name, members: { create: memberIds.map((userId) => ({ userId })) } } });
  return team;
}

teamsRouter.get(
  '/',
  requireRole(ROLES.STORE),
  ah(async (_req, res) => {
    const teams = await prisma.team.findMany({
      include: { ...teamInclude, _count: { select: { tasks: { where: { status: { in: ['ASSIGNED', 'IN_PROGRESS'] } } } } } },
      orderBy: { name: 'asc' },
    });
    res.json({ teams: teams.map(({ _count, ...t }) => ({ ...t, openJobs: _count.tasks })) });
  }),
);

teamsRouter.post(
  '/',
  requireRole(ROLES.MANAGERS),
  ah(async (req, res) => {
    const body = parse(newTeamSchema, req.body);
    const team = await prisma.$transaction((tx) => createTeam(tx, body, me(req).id));
    await audit(me(req).id, 'TEAM_CREATED', 'Team', team.id, `Created team ${team.name} (${team.members.length} technicians, led by ${team.leader.name})`);
    res.status(201).json({ team });
  }),
);

/** Removing a team keeps its past jobs (they stay with the leader) and its group chat; jobs still open block it. */
teamsRouter.delete(
  '/:id',
  requireRole(ROLES.MANAGERS),
  ah(async (req, res) => {
    const team = await prisma.team.findUnique({ where: { id: req.params.id } });
    if (!team) throw notFound('Team');
    const open = await prisma.task.count({ where: { teamId: team.id, status: { in: ['ASSIGNED', 'IN_PROGRESS'] } } });
    if (open) throw conflict(`${team.name} still has ${open} open ${open === 1 ? 'job' : 'jobs'}. Finish or reassign them first.`, 'TEAM_BUSY');
    await prisma.team.delete({ where: { id: team.id } });
    await audit(me(req).id, 'TEAM_DELETED', 'Team', team.id, `Removed team ${team.name}`);
    res.status(204).end();
  }),
);
