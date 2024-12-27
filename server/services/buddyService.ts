import { db } from "@db";
import { 
  buddyConnections, 
  practiceSessions, 
  sessionFeedback,
  users,
  type User 
} from "@db/schema";
import { eq, and, or, desc, sql } from "drizzle-orm";

export class BuddyService {
  static async findPotentialBuddies(userId: number, language: string) {
    // Find users interested in the same language who aren't already buddies
    const existingBuddies = await db
      .select({ buddyId: buddyConnections.buddyId })
      .from(buddyConnections)
      .where(eq(buddyConnections.userId, userId));

    const buddyIds = existingBuddies.map(b => b.buddyId);

    return db
      .select({
        id: users.id,
        username: users.username,
        languageInterest: buddyConnections.languageInterest,
      })
      .from(users)
      .leftJoin(
        buddyConnections,
        and(
          eq(buddyConnections.languageInterest, language),
          or(
            eq(buddyConnections.userId, users.id),
            eq(buddyConnections.buddyId, users.id)
          )
        )
      )
      .where(
        and(
          sql`${users.id} != ${userId}`,
          sql`${users.id} NOT IN (${buddyIds.length ? buddyIds.join(',') : 'NULL'})`
        )
      )
      .limit(10);
  }

  static async sendBuddyRequest(userId: number, buddyId: number, language: string) {
    return db.insert(buddyConnections).values({
      userId,
      buddyId,
      status: "pending",
      languageInterest: language,
    }).returning();
  }

  static async respondToBuddyRequest(userId: number, buddyId: number, accept: boolean) {
    return db
      .update(buddyConnections)
      .set({ 
        status: accept ? "accepted" : "rejected",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(buddyConnections.userId, buddyId),
          eq(buddyConnections.buddyId, userId),
          eq(buddyConnections.status, "pending")
        )
      )
      .returning();
  }

  static async schedulePracticeSession(
    initiatorId: number,
    participantId: number,
    sessionData: {
      language: string;
      scheduledFor: Date;
      duration: number;
      topic?: string;
    }
  ) {
    // Verify buddy connection exists
    const [connection] = await db
      .select()
      .from(buddyConnections)
      .where(
        or(
          and(
            eq(buddyConnections.userId, initiatorId),
            eq(buddyConnections.buddyId, participantId)
          ),
          and(
            eq(buddyConnections.userId, participantId),
            eq(buddyConnections.buddyId, initiatorId)
          )
        )
      );

    if (!connection || connection.status !== "accepted") {
      throw new Error("No active buddy connection found");
    }

    return db.insert(practiceSessions).values({
      initiatorId,
      participantId,
      language: sessionData.language,
      status: "scheduled",
      scheduledFor: sessionData.scheduledFor,
      duration: sessionData.duration,
      topic: sessionData.topic,
    }).returning();
  }

  static async getUpcomingSessions(userId: number) {
    return db
      .select({
        session: practiceSessions,
        buddy: {
          id: users.id,
          username: users.username,
        },
      })
      .from(practiceSessions)
      .leftJoin(
        users,
        or(
          and(
            eq(practiceSessions.participantId, users.id),
            eq(practiceSessions.initiatorId, userId)
          ),
          and(
            eq(practiceSessions.initiatorId, users.id),
            eq(practiceSessions.participantId, userId)
          )
        )
      )
      .where(
        and(
          or(
            eq(practiceSessions.initiatorId, userId),
            eq(practiceSessions.participantId, userId)
          ),
          eq(practiceSessions.status, "scheduled")
        )
      )
      .orderBy(practiceSessions.scheduledFor);
  }

  static async submitSessionFeedback(
    sessionId: number,
    giverId: number,
    receiverId: number,
    feedback: {
      rating: number;
      feedback?: string;
      helpfulness: number;
    }
  ) {
    return db.insert(sessionFeedback).values({
      sessionId,
      giverId,
      receiverId,
      rating: feedback.rating,
      feedback: feedback.feedback,
      helpfulness: feedback.helpfulness,
    }).returning();
  }

  static async getBuddyStats(userId: number) {
    const [stats] = await db
      .select({
        totalSessions: sql<number>`count(DISTINCT ${practiceSessions.id})`,
        avgRating: sql<number>`COALESCE(avg(${sessionFeedback.rating}), 0)`,
        avgHelpfulness: sql<number>`COALESCE(avg(${sessionFeedback.helpfulness}), 0)`,
      })
      .from(practiceSessions)
      .leftJoin(
        sessionFeedback,
        and(
          eq(sessionFeedback.sessionId, practiceSessions.id),
          eq(sessionFeedback.receiverId, userId)
        )
      )
      .where(
        or(
          eq(practiceSessions.initiatorId, userId),
          eq(practiceSessions.participantId, userId)
        )
      );

    return stats;
  }
}