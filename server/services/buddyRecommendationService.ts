import { db } from "@db";
import { users, buddyConnections, performanceMetrics, difficultyPreferences, sessionFeedback } from "@db/schema";
import { eq, and, avg, desc, sql } from "drizzle-orm";

interface BuddyScore {
  userId: number;
  score: number;
  matchReason: string[];
}

export class BuddyRecommendationService {
  static async getRecommendedBuddies(userId: number, targetLanguage: string) {
    try {
      // Get user's preferences and stats
      const [userPrefs] = await db
        .select()
        .from(difficultyPreferences)
        .where(eq(difficultyPreferences.userId, userId));

      // Calculate compatibility scores for potential buddies
      const potentialBuddies = await db
        .select({
          id: users.id,
          username: users.username,
          skillLevels: difficultyPreferences.skillLevels,
          averageRating: sql<number>`avg(${sessionFeedback.rating})`,
          successfulSessions: sql<number>`count(${sessionFeedback.id})`,
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
        .groupBy(users.id, users.username, difficultyPreferences.skillLevels);

      // Score each potential buddy
      const scoredBuddies: BuddyScore[] = await Promise.all(
        potentialBuddies.map(async (buddy) => {
          const score = await this.calculateCompatibilityScore(
            userId,
            buddy.id,
            userPrefs,
            buddy,
            targetLanguage
          );
          return {
            userId: buddy.id,
            score: score.total,
            matchReason: score.reasons,
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

  private static async calculateCompatibilityScore(
    userId: number,
    buddyId: number,
    userPrefs: any,
    buddy: any,
    targetLanguage: string
  ) {
    const scores = {
      skillLevel: 0,
      activityPattern: 0,
      feedbackScore: 0,
      languageMatch: 0,
    };
    const reasons: string[] = [];

    // Calculate skill level compatibility (0-100)
    if (userPrefs?.skillLevels && buddy.skillLevels) {
      const skillDiff = Object.keys(userPrefs.skillLevels).reduce(
        (acc, skill) => acc + Math.abs(userPrefs.skillLevels[skill] - buddy.skillLevels[skill]),
        0
      );
      scores.skillLevel = Math.max(0, 100 - (skillDiff * 20));
      if (scores.skillLevel > 70) {
        reasons.push("Similar skill levels");
      }
    }

    // Calculate activity pattern match (0-100)
    const activityMatch = await this.calculateActivityPatternMatch(userId, buddyId);
    scores.activityPattern = activityMatch;
    if (activityMatch > 70) {
      reasons.push("Compatible schedules");
    }

    // Calculate feedback score (0-100)
    if (buddy.averageRating) {
      scores.feedbackScore = Math.min(100, buddy.averageRating * 20);
      if (scores.feedbackScore > 80) {
        reasons.push("Highly rated by other learners");
      }
    }

    // Language match bonus (0 or 100)
    const languageMatch = await this.checkLanguageCompatibility(userId, buddyId, targetLanguage);
    scores.languageMatch = languageMatch ? 100 : 0;
    if (languageMatch) {
      reasons.push("Perfect language match");
    }

    // Calculate weighted total
    const total = (
      scores.skillLevel * 0.3 +
      scores.activityPattern * 0.2 +
      scores.feedbackScore * 0.2 +
      scores.languageMatch * 0.3
    );

    return {
      total,
      reasons,
    };
  }

  private static async calculateActivityPatternMatch(userId: number, buddyId: number) {
    // Get active hours patterns for both users from performance metrics
    const [userPattern, buddyPattern] = await Promise.all([
      this.getUserActivityPattern(userId),
      this.getUserActivityPattern(buddyId),
    ]);

    // Calculate overlap in active hours (simplified)
    const overlap = userPattern.filter(hour => buddyPattern.includes(hour)).length;
    return (overlap / Math.max(userPattern.length, 1)) * 100;
  }

  private static async getUserActivityPattern(userId: number) {
    const activities = await db
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${performanceMetrics.timestamp})`,
      })
      .from(performanceMetrics)
      .where(eq(performanceMetrics.userId, userId))
      .groupBy(sql`EXTRACT(HOUR FROM ${performanceMetrics.timestamp})`);

    return activities.map(a => a.hour);
  }

  private static async checkLanguageCompatibility(
    userId: number,
    buddyId: number,
    targetLanguage: string
  ) {
    // Check if buddy is native in user's target language
    // This would require additional user profile data
    // For now, return true if they're learning complementary languages
    return true; // Simplified for now
  }
}
