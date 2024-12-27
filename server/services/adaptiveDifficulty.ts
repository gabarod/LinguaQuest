import { db } from "@db";
import { performanceMetrics, difficultyPreferences, exercises } from "@db/schema";
import { eq, and, avg, desc, sql } from "drizzle-orm";

interface PerformanceAnalysis {
  averageAccuracy: number;
  averageResponseTime: number;
  totalAttempts: number;
  skillProficiency: Record<string, number>;
}

export class AdaptiveDifficultyService {
  private static readonly DIFFICULTY_RANGE = { min: 0.0, max: 2.0 };
  private static readonly ADJUSTMENT_THRESHOLD = 0.2;
  private static readonly SKILL_WEIGHTS = {
    accuracy: 0.4,
    responseTime: 0.3,
    attempts: 0.3,
  };

  static async analyzeUserPerformance(userId: number): Promise<PerformanceAnalysis> {
    const recentMetrics = await db
      .select({
        accuracy: avg(performanceMetrics.accuracy).mapWith(Number),
        responseTime: avg(performanceMetrics.responseTime).mapWith(Number),
        attempts: avg(performanceMetrics.attemptCount).mapWith(Number),
      })
      .from(performanceMetrics)
      .where(
        and(
          eq(performanceMetrics.userId, userId),
          sql`${performanceMetrics.timestamp} > NOW() - INTERVAL '7 days'`
        )
      )
      .groupBy(performanceMetrics.userId);

    const skillProficiency = await this.calculateSkillProficiency(userId);

    return {
      averageAccuracy: recentMetrics[0]?.accuracy ?? 0,
      averageResponseTime: recentMetrics[0]?.responseTime ?? 0,
      totalAttempts: recentMetrics[0]?.attempts ?? 0,
      skillProficiency,
    };
  }

  private static async calculateSkillProficiency(userId: number): Promise<Record<string, number>> {
    const skillMetrics = await db
      .select({
        skillType: exercises.skillType,
        accuracy: avg(performanceMetrics.accuracy).mapWith(Number),
      })
      .from(performanceMetrics)
      .innerJoin(exercises, eq(exercises.id, performanceMetrics.exerciseId))
      .where(eq(performanceMetrics.userId, userId))
      .groupBy(exercises.skillType);

    return Object.fromEntries(
      skillMetrics.map(({ skillType, accuracy }) => [skillType, accuracy ?? 0])
    );
  }

  static async adjustDifficulty(userId: number, exerciseId: number): Promise<number> {
    const [exercise] = await db
      .select()
      .from(exercises)
      .where(eq(exercises.id, exerciseId));

    if (!exercise) {
      throw new Error("Exercise not found");
    }

    const performance = await this.analyzeUserPerformance(userId);
    const currentPreferences = await this.getUserPreferences(userId);

    // Calculate new difficulty based on performance and current preferences
    const skillProficiency = performance.skillProficiency[exercise.skillType] ?? 0;
    const timeScore = this.normalizeResponseTime(performance.averageResponseTime);
    const accuracyScore = performance.averageAccuracy;

    const difficultyDelta =
      (accuracyScore * this.SKILL_WEIGHTS.accuracy +
        timeScore * this.SKILL_WEIGHTS.responseTime +
        skillProficiency * this.SKILL_WEIGHTS.attempts -
        0.5) *
      this.ADJUSTMENT_THRESHOLD;

    // Adjust difficulty within bounds
    const currentDifficulty = Number(exercise.difficulty);
    const newDifficulty = Math.max(
      this.DIFFICULTY_RANGE.min,
      Math.min(
        this.DIFFICULTY_RANGE.max,
        currentDifficulty + difficultyDelta
      )
    );

    // Update exercise difficulty
    await db
      .update(exercises)
      .set({ difficulty: newDifficulty.toString() })
      .where(eq(exercises.id, exerciseId));

    return newDifficulty;
  }

  private static normalizeResponseTime(responseTime: number): number {
    const MAX_EXPECTED_TIME = 30000; // 30 seconds
    return Math.max(0, 1 - responseTime / MAX_EXPECTED_TIME);
  }

  static async getUserPreferences(userId: number) {
    const [preferences] = await db
      .select()
      .from(difficultyPreferences)
      .where(eq(difficultyPreferences.userId, userId));

    if (!preferences) {
      // Create default preferences if none exist
      return db
        .insert(difficultyPreferences)
        .values({
          userId,
          preferredLevel: "beginner",
          adaptiveMode: true,
          skillLevels: {
            vocabulary: 1.0,
            grammar: 1.0,
            pronunciation: 1.0,
            comprehension: 1.0,
          },
        })
        .returning();
    }

    return preferences;
  }

  static async updateUserPreferences(
    userId: number,
    updates: Partial<typeof difficultyPreferences.$inferInsert>
  ) {
    return db
      .update(difficultyPreferences)
      .set({ ...updates, lastAdjustment: new Date() })
      .where(eq(difficultyPreferences.userId, userId))
      .returning();
  }
}