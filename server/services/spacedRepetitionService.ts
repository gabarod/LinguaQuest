import { addDays } from "date-fns";
import type { SpacedRepetitionData } from "@db/schema";

export class SpacedRepetitionService {
  // SM-2 algorithm implementation
  static calculateNextReview(
    quality: number,
    previousEaseFactor: number,
    previousInterval: number,
    consecutiveCorrect: number
  ): SpacedRepetitionData {
    // Quality should be between 0 and 5
    quality = Math.max(0, Math.min(5, quality));

    // Calculate new ease factor
    let easeFactor = previousEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    easeFactor = Math.max(1.3, easeFactor); // minimum ease factor is 1.3

    let intervalDays: number;

    if (quality < 3) {
      // If quality is poor, reset intervals
      consecutiveCorrect = 0;
      intervalDays = 1;
    } else {
      // Calculate next interval
      if (consecutiveCorrect === 0) {
        intervalDays = 1;
      } else if (consecutiveCorrect === 1) {
        intervalDays = 6;
      } else {
        intervalDays = Math.round(previousInterval * easeFactor);
      }
    }

    // Maximum interval is 365 days
    intervalDays = Math.min(365, intervalDays);

    const nextReview = addDays(new Date(), intervalDays);

    return {
      easeFactor,
      intervalDays,
      nextReview,
      quality,
    };
  }

  // Adaptive difficulty adjustment
  static calculateNewDifficulty(
    currentDifficulty: number,
    quality: number,
    responseTime: number
  ): number {
    // Normalize quality to 0-1 range
    const normalizedQuality = quality / 5;
    
    // Response time factor (assuming optimal time is 5-15 seconds)
    const responseTimeFactor = responseTime < 5000
      ? 0.8 // Too quick, might be guessing
      : responseTime > 15000
        ? 0.9 // Taking too long, might be too difficult
        : 1.0; // Optimal range

    // Calculate difficulty adjustment
    const targetDifficulty = normalizedQuality < 0.6
      ? currentDifficulty * 0.9 // Decrease difficulty if struggling
      : normalizedQuality > 0.8
        ? currentDifficulty * 1.1 // Increase difficulty if too easy
        : currentDifficulty;

    // Apply response time factor and clamp between 0.5 and 3.0
    const newDifficulty = targetDifficulty * responseTimeFactor;
    return Math.max(0.5, Math.min(3.0, newDifficulty));
  }

  // Get due cards query helper
  static getDueCardsQuery(userId: number, language: string) {
    const now = new Date();
    return {
      where: {
        userId,
        language,
        nextReview: {
          lte: now,
        },
      },
      orderBy: {
        nextReview: "asc",
      },
    };
  }
}
