import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { sql } from "drizzle-orm";
import { lessons, exercises, userProgress, userStats, users } from "@db/schema";
import { eq, and, desc } from "drizzle-orm";
import learningPathRouter from "./routes/learningPath";
import { logger } from './services/loggingService';

export function registerRoutes(app: Express): Server {
  // Create HTTP server
  const httpServer = createServer(app);

  setupAuth(app);

  // Use learning path router
  app.use(learningPathRouter);

  // Get all lessons
  app.get("/api/lessons", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const allLessons = await db.query.lessons.findMany({
        with: {
          progress: {
            where: eq(userProgress.userId, userId),
          },
        },
      });

      res.json(allLessons);
    } catch (error) {
      console.error("Error fetching lessons:", error);
      res.status(500).send("Failed to fetch lessons");
    }
  });

  // Get specific lesson
  app.get("/api/lessons/:id", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const lesson = await db.query.lessons.findFirst({
        where: eq(lessons.id, parseInt(req.params.id)),
      });

      if (!lesson) {
        return res.status(404).send("Lesson not found");
      }

      res.json(lesson);
    } catch (error) {
      console.error("Error fetching lesson:", error);
      res.status(500).send("Failed to fetch lesson");
    }
  });

  // Complete a lesson
  app.post("/api/lessons/:id/complete", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const lessonId = parseInt(req.params.id);

    try {
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
    } catch (error) {
      console.error("Error completing lesson:", error);
      res.status(500).send("Failed to complete lesson");
    }
  });

  // Get user progress
  app.get("/api/progress", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const stats = await db.query.userStats.findFirst({
        where: eq(userStats.userId, userId),
      });

      res.json(stats || {
        lessonsCompleted: 0,
        totalPoints: 0,
        streak: 0,
        lastActivity: new Date(),
      });
    } catch (error) {
      console.error("Error fetching progress:", error);
      res.status(500).send("Failed to fetch progress");
    }
  });

  return httpServer;
}