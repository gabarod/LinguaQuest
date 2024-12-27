import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { sql } from "drizzle-orm";
import { lessons, exercises, userProgress, userStats, milestones, userMilestones } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { format, subDays } from "date-fns";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Get all lessons
  app.get("/api/lessons", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const allLessons = await db.query.lessons.findMany({
      with: {
        userProgress: {
          where: eq(userProgress.userId, userId),
        },
      },
    });

    res.json(allLessons);
  });

  // Get specific lesson
  app.get("/api/lessons/:id", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const lesson = await db.query.lessons.findFirst({
      where: eq(lessons.id, parseInt(req.params.id)),
    });

    if (!lesson) {
      return res.status(404).send("Lesson not found");
    }

    res.json(lesson);
  });

  // Get exercises for a lesson
  app.get("/api/lessons/:id/exercises", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const lessonExercises = await db.query.exercises.findMany({
      where: eq(exercises.lessonId, parseInt(req.params.id)),
    });

    res.json(lessonExercises);
  });

  // Complete a lesson
  app.post("/api/lessons/:id/complete", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const lessonId = parseInt(req.params.id);

    await db.transaction(async (tx) => {
      // Update or create progress
      await tx
        .insert(userProgress)
        .values({
          userId,
          lessonId,
          completed: true,
          completedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [userProgress.userId, userProgress.lessonId],
          set: { completed: true, completedAt: new Date() },
        });

      // Update user stats
      const lesson = await tx.query.lessons.findFirst({
        where: eq(lessons.id, lessonId),
      });

      if (lesson) {
        await tx
          .insert(userStats)
          .values({
            userId,
            lessonsCompleted: 1,
            totalPoints: lesson.points,
            streak: 1,
            lastActivity: new Date(),
          })
          .onConflictDoUpdate({
            target: [userStats.userId],
            set: {
              lessonsCompleted: sql`${userStats.lessonsCompleted} + 1`,
              totalPoints: sql`${userStats.totalPoints} + ${lesson.points}`,
              streak: sql`${userStats.streak} + 1`,
              lastActivity: new Date(),
            },
          });
      }
    });

    res.json({ success: true });
  });

  // Get user progress
  app.get("/api/progress", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const stats = await db.query.userStats.findFirst({
      where: eq(userStats.userId, userId),
    });

    res.json(stats || {
      lessonsCompleted: 0,
      totalPoints: 0,
      streak: 0,
      lastActivity: new Date(),
    });
  });

  // Detailed progress endpoint
  app.get("/api/progress/detailed", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      // Get weekly progress
      const weeklyProgress = await Promise.all(
        Array.from({ length: 7 }, (_, i) => {
          const date = subDays(new Date(), i);
          return db
            .select({
              points: sql<number>`coalesce(sum(${lessons.points}), 0)`,
              exercises: sql<number>`count(*)`,
            })
            .from(userProgress)
            .leftJoin(lessons, eq(lessons.id, userProgress.lessonId))
            .where(sql`date(${userProgress.completedAt}) = ${format(date, 'yyyy-MM-dd')}`)
            .then(([result]) => ({
              day: format(date, 'EEE'),
              points: result?.points || 0,
              exercises: result?.exercises || 0,
            }));
        })
      );

      // Get skill distribution
      const skillDistribution = await db
        .select({
          skill: lessons.type,
          value: sql<number>`count(*)`,
        })
        .from(userProgress)
        .innerJoin(lessons, eq(lessons.id, userProgress.lessonId))
        .where(eq(userProgress.userId, userId))
        .groupBy(lessons.type);

      // Get user stats
      const stats = await db.query.userStats.findFirst({
        where: eq(userStats.userId, userId),
      });

      res.json({
        weeklyProgress: weeklyProgress.reverse(),
        skillDistribution,
        totalPoints: stats?.totalPoints || 0,
        lessonsCompleted: stats?.lessonsCompleted || 0,
        streak: stats?.streak || 0,
      });
    } catch (error) {
      console.error("Error fetching detailed progress:", error);
      res.status(500).send("Failed to fetch progress data");
    }
  });

  // Get user's milestones with unlock status
  app.get("/api/milestones", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      // Get all milestones with user unlock status
      const userMilestoneData = await db
        .select({
          id: milestones.id,
          title: milestones.title,
          description: milestones.description,
          type: milestones.type,
          points: milestones.points,
          position: milestones.position,
          requiredLessons: milestones.requiredLessons,
          requiredPoints: milestones.requiredPoints,
          unlockedAt: userMilestones.unlockedAt,
        })
        .from(milestones)
        .leftJoin(
          userMilestones,
          and(
            eq(userMilestones.milestoneId, milestones.id),
            eq(userMilestones.userId, userId)
          )
        );

      // Get user stats for milestone unlocking logic
      const userStat = await db.query.userStats.findFirst({
        where: eq(userStats.userId, userId),
      });

      // Determine which milestones are unlocked based on user progress
      const milestonesWithStatus = userMilestoneData.map((milestone) => ({
        ...milestone,
        unlocked:
          milestone.unlockedAt !== null ||
          ((userStat?.lessonsCompleted ?? 0) >= milestone.requiredLessons &&
            (userStat?.totalPoints ?? 0) >= milestone.requiredPoints),
      }));

      res.json(milestonesWithStatus);
    } catch (error) {
      console.error("Error fetching milestones:", error);
      res.status(500).send("Failed to fetch milestones");
    }
  });

  // Update milestone status (unlock)
  app.post("/api/milestones/:id/unlock", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const milestoneId = parseInt(req.params.id);

    try {
      const milestone = await db.query.milestones.findFirst({
        where: eq(milestones.id, milestoneId),
      });

      if (!milestone) {
        return res.status(404).send("Milestone not found");
      }

      const userStat = await db.query.userStats.findFirst({
        where: eq(userStats.userId, userId),
      });

      // Check if user meets the requirements
      if (
        (userStat?.lessonsCompleted ?? 0) < milestone.requiredLessons ||
        (userStat?.totalPoints ?? 0) < milestone.requiredPoints
      ) {
        return res.status(400).send("Requirements not met");
      }

      // Record the milestone unlock
      await db.insert(userMilestones).values({
        userId,
        milestoneId,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error unlocking milestone:", error);
      res.status(500).send("Failed to unlock milestone");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}