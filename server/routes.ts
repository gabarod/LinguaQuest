import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { sql } from "drizzle-orm";
import { lessons, exercises, userProgress, userStats } from "@db/schema";
import { eq } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Get all lessons
  app.get("/api/lessons", async (req, res) => {
    if (!req.user?.id) {
      return res.status(401).send("Not authenticated");
    }

    const allLessons = await db.query.lessons.findMany({
      with: {
        userProgress: {
          where: eq(userProgress.userId, req.user.id),
        },
      },
    });

    res.json(allLessons);
  });

  // Get specific lesson
  app.get("/api/lessons/:id", async (req, res) => {
    if (!req.user?.id) {
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
    if (!req.user?.id) {
      return res.status(401).send("Not authenticated");
    }

    const lessonExercises = await db.query.exercises.findMany({
      where: eq(exercises.lessonId, parseInt(req.params.id)),
    });

    res.json(lessonExercises);
  });

  // Complete a lesson
  app.post("/api/lessons/:id/complete", async (req, res) => {
    if (!req.user?.id) {
      return res.status(401).send("Not authenticated");
    }

    const lessonId = parseInt(req.params.id);

    await db.transaction(async (tx) => {
      // Update or create progress
      await tx
        .insert(userProgress)
        .values({
          userId: req.user.id,
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
            userId: req.user.id,
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
    if (!req.user?.id) {
      return res.status(401).send("Not authenticated");
    }

    const stats = await db.query.userStats.findFirst({
      where: eq(userStats.userId, req.user.id),
    });

    res.json(stats || {
      lessonsCompleted: 0,
      totalPoints: 0,
      streak: 0,
      lastActivity: new Date(),
    });
  });

  const httpServer = createServer(app);
  return httpServer;
}