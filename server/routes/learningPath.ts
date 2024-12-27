import { Router } from "express";
import { db } from "@db";
import { lessons, exercises, userProgress, userStats } from "@db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

// Get user's learning progress
router.get("/api/learning-path", async (req, res) => {
  if (!req.user) {
    return res.status(401).send("Not authenticated");
  }

  try {
    // Get user's completed lessons
    const progress = await db
      .select()
      .from(userProgress)
      .where(eq(userProgress.userId, req.user.id));

    // Get all lessons
    const allLessons = await db
      .select()
      .from(lessons);

    // Calculate overall progress
    const completedLessons = progress.filter((p) => p.completed).length;
    const progressPercentage = (completedLessons / allLessons.length) * 100;

    // Transform lessons into learning path nodes
    const nodes = allLessons.map((lesson) => {
      const lessonProgress = progress.find((p) => p.lessonId === lesson.id);

      return {
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        status: lessonProgress?.completed
          ? "completed"
          : lesson.id <= completedLessons + 1
          ? "available"
          : "locked",
        difficulty: lesson.difficulty,
        estimatedTime: lesson.duration,
      };
    });

    // Get user stats
    const userStat = await db.query.userStats.findFirst({
      where: eq(userStats.userId, req.user.id),
    });

    res.json({
      nodes,
      progress: progressPercentage,
      stats: {
        totalPoints: userStat?.totalPoints || 0,
        lessonsCompleted: userStat?.lessonsCompleted || 0,
        streak: userStat?.streak || 0,
      }
    });
  } catch (error) {
    console.error("Error fetching learning path:", error);
    res.status(500).send("Internal server error");
  }
});

export default router;