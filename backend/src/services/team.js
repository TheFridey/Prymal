import { and, count, eq, gt } from 'drizzle-orm';
import { db } from '../db/index.js';
import { organisationInvitations, organisations, users } from '../db/schema.js';
import { getPlanSeatLimit } from './entitlements.js';

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export async function getSeatSnapshot(orgId) {
  const [membersResult, pendingInvitesResult, organisation] = await Promise.all([
    db.select({ count: count() }).from(users).where(eq(users.orgId, orgId)),
    db
      .select({ count: count() })
      .from(organisationInvitations)
      .where(
        and(
          eq(organisationInvitations.orgId, orgId),
          eq(organisationInvitations.status, 'pending'),
          gt(organisationInvitations.expiresAt, new Date()),
        ),
      ),
    db.query.organisations.findFirst({
      where: eq(organisations.id, orgId),
    }),
  ]);

  const seatLimit =
    organisation?.seatLimit ??
    getPlanSeatLimit(organisation?.plan);
  const members = membersResult[0]?.count ?? 0;
  const pendingInvites = pendingInvitesResult[0]?.count ?? 0;

  return {
    seatLimit,
    members,
    pendingInvites,
    reservedSeats: members + pendingInvites,
    availableSeats: Math.max(seatLimit - members - pendingInvites, 0),
  };
}

export async function assertSeatCapacity(orgId, requestedSeats = 1) {
  const seatSnapshot = await getSeatSnapshot(orgId);

  if (seatSnapshot.availableSeats < requestedSeats) {
    const error = new Error(
      `No seats available. ${seatSnapshot.members} members and ${seatSnapshot.pendingInvites} pending invites already use ${seatSnapshot.reservedSeats} of ${seatSnapshot.seatLimit} seats.`,
    );
    error.status = 409;
    error.code = 'SEAT_LIMIT_REACHED';
    throw error;
  }

  return seatSnapshot;
}

export function isInvitationExpired(invitation) {
  return !invitation?.expiresAt || new Date(invitation.expiresAt).getTime() < Date.now();
}
