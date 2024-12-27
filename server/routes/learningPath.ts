import { Router } from "express";
import { db } from "@db";
import { lessons, exercises, languageProgress } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { logger } from '../services/loggingService';

const router = Router();

// Get user's learning progress
router.get("/api/learning-path", async (req, res) => {
  if (!req.user) {
    return res.status(401).send("Not authenticated");
  }

  try {
    // Get user's progress for current language
    const progress = await db.query.languageProgress.findFirst({
      where: and(
        eq(languageProgress.userId, req.user.id),
        eq(languageProgress.language, req.user.targetLanguage)
      ),
    });

    // Get all lessons for the user's target language
    const allLessons = await db
      .select()
      .from(lessons)
      .where(eq(lessons.language, req.user.targetLanguage));

    // Calculate overall progress
    const completedLessons = progress?.lessonsCompleted || 0;
    const progressPercentage = allLessons.length > 0 
      ? (completedLessons / allLessons.length) * 100 
      : 0;

    // Transform lessons into learning path nodes
    const nodes = allLessons.map((lesson) => {
      return {
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        status: lesson.id <= completedLessons + 1 ? "available" : "locked",
        difficulty: lesson.difficulty,
        estimatedTime: lesson.duration,
      };
    });

    res.json({
      nodes,
      progress: progressPercentage,
      stats: {
        totalPoints: progress?.totalPoints || 0,
        lessonsCompleted: progress?.lessonsCompleted || 0,
        streak: progress?.streak || 0,
      }
    });
  } catch (error) {
    logger.error("Error fetching learning path:", error);
    res.status(500).send("Internal server error");
  }
});

export default router;