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

// Define supported languages (this needs to be defined elsewhere in your project)
const supportedLanguages = ["english", "spanish", "french"]; // Example

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  setupAuth(app);

  // Use learning path router
  app.use(learningPathRouter);

  // Get initial lessons
  app.get("/api/lessons/initial", async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).send("Not authenticated");
      }

      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        return res.status(404).send("User not found");
      }

      // Filter lessons by user's target language
      const allLessons = await db.query.lessons.findMany({
        where: eq(lessons.language, user.targetLanguage),
        orderBy: [desc(lessons.points)],
      });

      res.json(allLessons);
    } catch (error) {
      logger.error("Error fetching lessons:", error);
      res.status(500).send("Failed to fetch lessons");
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
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        return res.status(404).send("User not found");
      }

      // Return initial greeting message in the target language
      const messages: ChatMessage[] = [
        {
          id: "1",
          role: "assistant",
          content: `¡Hola! Soy tu profesor de ${user.targetLanguage}. Estoy aquí para ayudarte a practicar y mejorar tus habilidades. ¿Qué te gustaría practicar hoy? Podemos trabajar en gramática, vocabulario, o tener una conversación práctica.`,
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

      // Get user's target language
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        return res.status(404).send("User not found");
      }

      // Call Perplexity API with enhanced language learning prompt
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.1-sonar-small-128k-online",
          messages: [
            {
              role: "system",
              content: `You are an experienced ${user.targetLanguage} language teacher. Your role is to:
                       1. Always respond in ${user.targetLanguage} unless the user specifically asks for clarification
                       2. Correct any grammatical or vocabulary errors in the user's messages, explaining the corrections
                       3. Maintain an educational conversation by asking follow-up questions
                       4. Introduce new vocabulary and expressions naturally in context
                       5. Focus on practical, everyday language use
                       6. Encourage the user to express themselves more fully
                       7. Provide positive reinforcement while maintaining high standards
                       8. If the user makes mistakes, provide corrections in a supportive way
                       Remember to keep responses concise and clear, suitable for language learners.`
            },
            {
              role: "user",
              content
            }
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const perplexityResponse = await response.json();
      const aiMessage = perplexityResponse.choices[0].message.content;

      const chatResponse: ChatMessage = {
        id: Date.now().toString(),
        role: "assistant",
        content: aiMessage,
        timestamp: new Date(),
      };

      res.json(chatResponse);
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

  // Get progress
  app.get("/api/progress", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        return res.status(404).send("User not found");
      }

      const stats = await db.query.userStats.findFirst({
        where: and(
          eq(userStats.userId, userId),
          eq(userStats.language, user.targetLanguage)
        ),
      });

      if (!stats) {
        // Create initial stats for new user and language
        const [newStats] = await db
          .insert(userStats)
          .values({
            userId,
            language: user.targetLanguage,
            lessonsCompleted: 0,
            totalPoints: 0,
            streak: 0,
            lastActivity: new Date(),
          })
          .returning();

        return res.json(newStats);
      }

      res.json(stats);
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

      if (!stats) {
        // Create initial stats for new user
        const [newStats] = await db
          .insert(userStats)
          .values({
            userId,
            lessonsCompleted: 0,
            totalPoints: 0,
            streak: 0,
            lastActivity: new Date(),
          })
          .returning();

        return res.json({
          weeklyProgress: [],
          skillDistribution: [],
          ...newStats,
        });
      }

      res.json({
        weeklyProgress: weeklyProgress.map(wp => ({
          day: format(new Date(wp.day), 'EEE'),
          points: wp.points || 0,
          exercises: wp.exercises || 0,
        })),
        skillDistribution,
        totalPoints: stats.totalPoints || 0,
        lessonsCompleted: stats.lessonsCompleted || 0,
        streak: stats.streak || 0,
      });
    } catch (error) {
      logger.error("Error fetching detailed progress:", error);
      res.status(500).send("Failed to fetch detailed progress");
    }
  });

  // Add this route after the existing /api/user endpoint
  app.post("/api/user/language", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const { language } = req.body;
      if (!supportedLanguages.includes(language)) {
        return res.status(400).send("Unsupported language");
      }

      // Update user's target language
      const [updatedUser] = await db
        .update(users)
        .set({ targetLanguage: language })
        .where(eq(users.id, userId))
        .returning();

      // Ensure user stats exist for this language
      const existingStats = await db.query.userStats.findFirst({
        where: and(
          eq(userStats.userId, userId),
          eq(userStats.language, language)
        ),
      });

      if (!existingStats) {
        await db.insert(userStats).values({
          userId,
          language,
          lessonsCompleted: 0,
          totalPoints: 0,
          streak: 0,
          lastActivity: new Date(),
        });
      }

      res.json({
        success: true,
        message: "Language updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      logger.error("Error updating user language:", error);
      res.status(500).send("Failed to update language");
    }
  });

  return httpServer;
}