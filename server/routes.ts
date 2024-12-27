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

// Define message interface
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

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

  // Chat routes
  app.get("/api/chat/messages", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      // For now, return mock chat history
      const messages: ChatMessage[] = [
        {
          id: "1",
          role: "assistant",
          content: "Hello! I'm your language learning assistant. How can I help you practice today?",
          timestamp: new Date(),
        },
      ];
      res.json(messages);
    } catch (error) {
      logger.error("Error fetching chat messages:", error);
      res.status(500).send("Failed to fetch chat messages");
    }
  });

  app.post("/api/chat/send", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const { content } = req.body;
      if (!content) {
        return res.status(400).send("Message content is required");
      }

      // Here we would normally call the AI service for response
      const response: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: "I understand you're practicing English. Let me help you with that! What would you like to practice?",
        timestamp: new Date(),
      };

      res.json(response);
    } catch (error) {
      logger.error("Error sending chat message:", error);
      res.status(500).send("Failed to send message");
    }
  });

  // Language buddies routes
  app.get("/api/buddies", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const language = req.query.language as string;

    try {
      const buddiesQuery = db
        .select({
          id: users.id,
          username: users.username,
          nativeLanguage: users.nativeLanguage,
          targetLanguage: users.targetLanguage,
        })
        .from(users)
        .where(
          language
            ? eq(users.nativeLanguage, language)
            : sql`true`
        )
        .limit(20);

      const buddies = await buddiesQuery;

      // Add mock data for demonstration
      const enrichedBuddies = buddies.map(buddy => ({
        ...buddy,
        lastActive: new Date(),
        interests: ["Music", "Travel", "Movies"],
      }));

      res.json(enrichedBuddies);
    } catch (error) {
      logger.error("Error fetching buddies:", error);
      res.status(500).send("Failed to fetch language buddies");
    }
  });

  // Leaderboard routes
  app.get("/api/leaderboard/:period", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const period = req.params.period as "global" | "weekly" | "monthly";

      const leaderboardQuery = db
        .select({
          id: users.id,
          username: users.username,
          totalPoints: userStats.totalPoints,
          weeklyXP: userStats.weeklyXP,
          monthlyXP: userStats.monthlyXP,
          streak: userStats.streak,
        })
        .from(users)
        .innerJoin(userStats, eq(users.id, userStats.userId))
        .orderBy(
          period === "weekly"
            ? desc(userStats.weeklyXP)
            : period === "monthly"
            ? desc(userStats.monthlyXP)
            : desc(userStats.totalPoints)
        )
        .limit(50);

      const leaderboard = await leaderboardQuery;
      res.json(leaderboard);
    } catch (error) {
      logger.error("Error fetching leaderboard:", error);
      res.status(500).send("Failed to fetch leaderboard");
    }
  });

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
        globalRank: stats?.globalRank || 999,
        weeklyRank: Math.floor(Math.random() * 100) + 1, // Mock data
        monthlyRank: Math.floor(Math.random() * 100) + 1, // Mock data
        totalPoints: stats?.totalPoints || 0,
        weeklyXP: stats?.weeklyXP || 0,
        monthlyXP: stats?.monthlyXP || 0,
      });
    } catch (error) {
      logger.error("Error fetching user stats:", error);
      res.status(500).send("Failed to fetch user stats");
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

  return httpServer;
}