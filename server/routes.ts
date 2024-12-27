import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { sql } from "drizzle-orm";
import { lessons, exercises, userProgress, userStats, users, dailyChallenges } from "@db/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import learningPathRouter from "./routes/learningPath";
import { logger } from './services/loggingService';
import { subDays, startOfDay, format } from 'date-fns';

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  setupAuth(app);

  // Use learning path router
  app.use(learningPathRouter);

  // Get initial lessons
  app.get("/api/lessons/initial", async (req, res) => {
    try {
      // Insert initial lessons if they don't exist
      const initialLessons = [
        {
          title: "Basic Greetings",
          description: "Learn essential greetings and introductions in English",
          type: "conversation",
          level: "beginner",
          language: "english",
          points: 100,
          duration: 15,
        },
        {
          title: "Common Phrases",
          description: "Master everyday expressions and useful phrases",
          type: "vocabulary",
          level: "beginner",
          language: "english",
          points: 150,
          duration: 20,
        },
        {
          title: "Present Tense",
          description: "Understanding and using the present tense in English",
          type: "grammar",
          level: "beginner",
          language: "english",
          points: 200,
          duration: 25,
        },
      ];

      for (const lesson of initialLessons) {
        await db
          .insert(lessons)
          .values(lesson)
          .onConflictDoNothing();
      }

      const allLessons = await db.query.lessons.findMany({
        orderBy: [desc(lessons.points)],
      });

      res.json(allLessons);
    } catch (error) {
      console.error("Error setting up initial lessons:", error);
      res.status(500).send("Failed to set up initial lessons");
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
      logger.error("Error fetching progress:", error);
      res.status(500).send("Failed to fetch progress");
    }
  });

  // Get detailed progress for dashboard
  app.get("/api/progress/detailed", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      // Get weekly progress for the last 7 days
      const today = startOfDay(new Date());
      const weekAgo = subDays(today, 6);

      const weeklyProgress = await db
        .select({
          day: sql<string>`date_trunc('day', ${userProgress.completedAt})::text`,
          points: sql<number>`sum(${lessons.points})`,
          exercises: sql<number>`count(*)`,
        })
        .from(userProgress)
        .innerJoin(lessons, eq(lessons.id, userProgress.lessonId))
        .where(and(
          eq(userProgress.userId, userId),
          gte(userProgress.completedAt, weekAgo)
        ))
        .groupBy(sql`date_trunc('day', ${userProgress.completedAt})`)
        .orderBy(sql`date_trunc('day', ${userProgress.completedAt})`);

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
        weeklyProgress: weeklyProgress.map(wp => ({
          day: format(new Date(wp.day), 'EEE'),
          points: wp.points || 0,
          exercises: wp.exercises || 0,
        })),
        skillDistribution,
        totalPoints: stats?.totalPoints || 0,
        lessonsCompleted: stats?.lessonsCompleted || 0,
        streak: stats?.streak || 0,
      });
    } catch (error) {
      logger.error("Error fetching detailed progress:", error);
      res.status(500).send("Failed to fetch detailed progress");
    }
  });

  // Get daily challenge
  app.get("/api/daily-challenge", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const today = startOfDay(new Date());
      const [dailyChallenge] = await db
        .select()
        .from(dailyChallenges)
        .where(and(
          eq(dailyChallenges.userId, userId),
          gte(dailyChallenges.createdAt, today)
        ))
        .limit(1);

      if (!dailyChallenge) {
        // Create a new daily challenge if none exists
        const [newChallenge] = await db
          .insert(dailyChallenges)
          .values({
            userId,
            type: 'practice',
            description: 'Complete 3 lessons today',
            points: 100,
          })
          .returning();

        return res.json(newChallenge);
      }

      res.json(dailyChallenge);
    } catch (error) {
      logger.error("Error fetching daily challenge:", error);
      res.status(500).send("Failed to fetch daily challenge");
    }
  });

  // Get user stats for habit tracking
  app.get("/api/leaderboard/user/stats", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const stats = await db.query.userStats.findFirst({
        where: eq(userStats.userId, userId),
      });

      res.json({
        streak: stats?.streak || 0,
        weeklyXP: stats?.weeklyXP || 0,
        monthlyXP: stats?.monthlyXP || 0,
        completedChallenges: stats?.lessonsCompleted || 0,
        lastActivity: stats?.lastActivity || new Date(),
      });
    } catch (error) {
      logger.error("Error fetching user stats:", error);
      res.status(500).send("Failed to fetch user stats");
    }
  });

  return httpServer;
}