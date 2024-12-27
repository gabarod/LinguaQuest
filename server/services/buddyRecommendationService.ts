import { db } from "@db";
import { users, buddyConnections, performanceMetrics, difficultyPreferences, sessionFeedback } from "@db/schema";
import { eq, and, avg, desc, sql, or } from "drizzle-orm";

interface BuddyScore {
  userId: number;
  score: number;
  matchReason: string[];
  compatibility: {
    skillLevel: number;
    schedule: number;
    feedback: number;
    languageMatch: number;
  };
}

export class BuddyRecommendationService {
  static async getRecommendedBuddies(userId: number, targetLanguage: string) {
    try {
      // Get user's preferences and stats
      const [userPrefs] = await db
        .select({
          id: users.id,
          skillLevels: difficultyPreferences.skillLevels,
          preferredLevel: difficultyPreferences.preferredLevel
        })
        .from(users)
        .leftJoin(
          difficultyPreferences,
          eq(difficultyPreferences.userId, users.id)
        )
        .where(eq(users.id, userId));

      // Get potential buddies with their stats and preferences
      const potentialBuddies = await db
        .select({
          id: users.id,
          username: users.username,
          skillLevels: difficultyPreferences.skillLevels,
          preferredLevel: difficultyPreferences.preferredLevel,
          rating: sql<number>`COALESCE(avg(${sessionFeedback.rating}), 0)`,
          successfulSessions: sql<number>`count(${sessionFeedback.id})`,
          lastActive: sql<Date>`MAX(${performanceMetrics.timestamp})`
        })
        .from(users)
        .leftJoin(
          difficultyPreferences,
          eq(difficultyPreferences.userId, users.id)
        )
        .leftJoin(
          sessionFeedback,
          eq(sessionFeedback.receiverId, users.id)
        )
        .leftJoin(
          performanceMetrics,
          eq(performanceMetrics.userId, users.id)
        )
        .where(
          and(
            sql`${users.id} != ${userId}`,
            sql`NOT EXISTS (
              SELECT 1 FROM ${buddyConnections}
              WHERE (${buddyConnections.userId} = ${userId} AND ${buddyConnections.buddyId} = ${users.id})
              OR (${buddyConnections.userId} = ${users.id} AND ${buddyConnections.buddyId} = ${userId})
            )`
          )
        )
        .groupBy(users.id, users.username, difficultyPreferences.skillLevels, difficultyPreferences.preferredLevel);

      // Score each potential buddy
      const scoredBuddies: BuddyScore[] = await Promise.all(
        potentialBuddies.map(async (buddy) => {
          const compatibilityScores = await this.calculateCompatibilityScores(
            userPrefs,
            buddy,
            targetLanguage
          );

          const totalScore = this.calculateTotalScore(compatibilityScores);
          const matchReasons = this.generateMatchReasons(compatibilityScores, buddy);

          return {
            userId: buddy.id,
            score: totalScore,
            matchReason: matchReasons,
            compatibility: compatibilityScores
          };
        })
      );

      // Sort by score and return top matches
      return scoredBuddies
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

    } catch (error) {
      console.error("Error in buddy recommendations:", error);
      throw error;
    }
  }

  private static async calculateCompatibilityScores(
    userPrefs: any,
    buddy: any,
    targetLanguage: string
  ) {
    const scores = {
      skillLevel: 0,
      schedule: 0,
      feedback: 0,
      languageMatch: 0
    };

    // Calculate skill level compatibility (0-100)
    if (userPrefs?.skillLevels && buddy.skillLevels) {
      const skillDiff = Object.entries(userPrefs.skillLevels).reduce(
        (acc, [skill, level]) => {
          const buddyLevel = buddy.skillLevels[skill] || 0;
          // Closer skill levels get higher scores
          return acc + (100 - Math.abs(level - buddyLevel) * 20);
        },
        0
      ) / Object.keys(userPrefs.skillLevels).length;

      scores.skillLevel = skillDiff;
    }

    // Calculate schedule compatibility (0-100)
    const scheduleMatch = await this.calculateScheduleCompatibility(
      userPrefs.id,
      buddy.id
    );
    scores.schedule = scheduleMatch;

    // Calculate feedback score (0-100)
    if (buddy.rating) {
      scores.feedback = Math.min(100, buddy.rating * 20);
    }

    // Language match bonus (0-100)
    const languageMatch = await this.checkLanguageCompatibility(
      userPrefs.id,
      buddy.id,
      targetLanguage
    );
    scores.languageMatch = languageMatch ? 100 : 0;

    return scores;
  }

  private static calculateTotalScore(scores: {
    skillLevel: number;
    schedule: number;
    feedback: number;
    languageMatch: number;
  }) {
    // Weighted average of all scores
    return (
      scores.skillLevel * 0.3 +
      scores.schedule * 0.2 +
      scores.feedback * 0.2 +
      scores.languageMatch * 0.3
    );
  }

  private static generateMatchReasons(
    scores: {
      skillLevel: number;
      schedule: number;
      feedback: number;
      languageMatch: number;
    },
    buddy: any
  ): string[] {
    const reasons: string[] = [];

    if (scores.skillLevel > 80) {
      reasons.push("Very similar skill levels");
    } else if (scores.skillLevel > 60) {
      reasons.push("Compatible skill levels");
    }

    if (scores.schedule > 80) {
      reasons.push("Highly compatible schedules");
    } else if (scores.schedule > 60) {
      reasons.push("Similar active hours");
    }

    if (scores.feedback > 80) {
      reasons.push("Excellent peer ratings");
    } else if (scores.feedback > 60) {
      reasons.push("Good peer feedback");
    }

    if (scores.languageMatch === 100) {
      reasons.push("Perfect language match");
    }

    if (buddy.successfulSessions > 10) {
      reasons.push("Experienced language partner");
    }

    return reasons;
  }

  private static async calculateScheduleCompatibility(
    userId1: number,
    userId2: number
  ) {
    const [pattern1, pattern2] = await Promise.all([
      this.getUserActivityPattern(userId1),
      this.getUserActivityPattern(userId2)
    ]);

    // Calculate overlap in active hours
    const overlap = pattern1.filter(hour => pattern2.includes(hour)).length;
    const maxHours = Math.max(pattern1.length, pattern2.length) || 1;

    // More shared active hours = higher compatibility
    return (overlap / maxHours) * 100;
  }

  private static async getUserActivityPattern(userId: number) {
    const activities = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${performanceMetrics.timestamp})`
      })
      .from(performanceMetrics)
      .where(eq(performanceMetrics.userId, userId))
      .groupBy(sql`EXTRACT(HOUR FROM ${performanceMetrics.timestamp})`);

    return activities.map(a => a.hour);
  }

  private static async checkLanguageCompatibility(
    userId1: number,
    userId2: number,
    targetLanguage: string
  ) {
    // Check if users have complementary language interests
    const connections = await db
      .select()
      .from(buddyConnections)
      .where(
        or(
          and(
            eq(buddyConnections.userId, userId1),
            eq(buddyConnections.languageInterest, targetLanguage)
          ),
          and(
            eq(buddyConnections.userId, userId2),
            eq(buddyConnections.languageInterest, targetLanguage)
          )
        )
      );

    return connections.length > 0;
  }
}