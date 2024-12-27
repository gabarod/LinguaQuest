import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { sql } from "drizzle-orm";
import { lessons, exercises, userProgress, userStats, milestones, userMilestones, dailyChallenges, userChallengeAttempts, users, flashcards, flashcardProgress, difficultyPreferences, languages, userLanguages, communityPosts, postLikes, postComments, quizzes, quizAttempts, pronunciationAttempts } from "@db/schema";
import { eq, and, gte, lte, desc, or, asc } from "drizzle-orm";
import { format, subDays, addDays } from "date-fns";
import multer from "multer";
import learningPathRouter from "./routes/learningPath";
import { logger } from './services/loggingService';
import { SpacedRepetitionService } from './services/spacedRepetitionService';
import {BuddyRecommendationService} from "./services/buddyRecommendationService";
import { QuizGeneratorService } from "./services/quizGeneratorService";
import type { User } from "@db/schema";
import { ChatService } from "./services/chatService";
import { BuddyService } from "./services/buddyService";
import { LanguageExchangeService } from "./services/languageExchangeService";
import { PronunciationService } from "./services/pronunciationService";


export function registerRoutes(app: Express): Server {
  // Create HTTP server
  const httpServer = createServer(app);

  // Initialize WebSocket service for language exchange
  new LanguageExchangeService(httpServer);

  setupAuth(app);

  // Configure multer for handling audio file uploads
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max file size
    },
  });

  // Pronunciation analysis endpoint
  app.post("/api/pronunciation/analyze", upload.single("audio"), async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    if (!req.file || !req.body.text || !req.body.language) {
      return res.status(400).send("Missing required fields");
    }

    try {
      // Analyze pronunciation using Perplexity AI
      const analysis = await PronunciationService.analyzePronunciation(
        req.file.buffer,
        req.body.text,
        req.body.language
      );

      // Save metrics for tracking progress
      if (req.body.exerciseId) {
        await PronunciationService.savePronunciationMetrics(
          userId,
          parseInt(req.body.exerciseId),
          analysis.score
        );
      }

      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing pronunciation:", error);
      res.status(500).send("Failed to analyze pronunciation");
    }
  });

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


  // Endpoints para idiomas
  app.get("/api/languages", async (req, res) => {
    try {
      const allLanguages = await db
        .select()
        .from(languages);

      res.json(allLanguages);
    } catch (error) {
      console.error("Error fetching languages:", error);
      res.status(500).send("Failed to fetch languages");
    }
  });

  app.get("/api/languages/:code", async (req, res) => {
    try {
      const [language] = await db
        .select()
        .from(languages)
        .where(eq(languages.code, req.params.code));

      if (!language) {
        return res.status(404).send("Language not found");
      }

      res.json(language);
    } catch (error) {
      console.error("Error fetching language:", error);
      res.status(500).send("Failed to fetch language");
    }
  });

  app.get("/api/user/languages", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const userLangs = await db
        .select({
          code: languages.code,
          name: languages.name,
          nativeName: languages.nativeName,
          flag: languages.flag,
          isRightToLeft: languages.isRightToLeft,
          proficiencyLevel: userLanguages.proficiencyLevel,
          isNative: userLanguages.isNative,
          isLearning: userLanguages.isLearning,
          startedLearningAt: userLanguages.startedLearningAt,
          lastPracticed: userLanguages.lastPracticed,
        })
        .from(userLanguages)
        .innerJoin(languages, eq(languages.code, userLanguages.languageCode))
        .where(eq(userLanguages.userId, userId));

      res.json(userLangs);
    } catch (error) {
      console.error("Error fetching user languages:", error);
      res.status(500).send("Failed to fetch user languages");
    }
  });

  // Actualizar idiomas del usuario
  app.post("/api/user/languages", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const { languageCode, isNative, isLearning, proficiencyLevel } = req.body;

    try {
      const [language] = await db
        .select()
        .from(languages)
        .where(eq(languages.code, languageCode));

      if (!language) {
        return res.status(404).send("Language not found");
      }

      await db
        .insert(userLanguages)
        .values({
          userId,
          languageCode,
          isNative,
          isLearning,
          proficiencyLevel,
        })
        .onConflictDoUpdate({
          target: [userLanguages.userId, userLanguages.languageCode],
          set: {
            isNative,
            isLearning,
            proficiencyLevel,
            lastPracticed: new Date(),
          },
        });

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating user languages:", error);
      res.status(500).send("Failed to update user languages");
    }
  });

  // Get today's challenge
  app.get("/api/challenges/daily", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const now = new Date();
      const challenge = await db.query.dailyChallenges.findFirst({
        where: and(
          lte(dailyChallenges.availableFrom, now),
          gte(dailyChallenges.availableUntil, now)
        ),
      });

      if (!challenge) {
        return res.status(404).send("No active challenge found");
      }

      // Check if user has already attempted this challenge
      const attempt = await db.query.userChallengeAttempts.findFirst({
        where: and(
          eq(userChallengeAttempts.userId, userId),
          eq(userChallengeAttempts.challengeId, challenge.id)
        ),
      });

      res.json({
        ...challenge,
        completed: !!attempt,
        score: attempt?.score,
      });
    } catch (error) {
      console.error("Error fetching daily challenge:", error);
      res.status(500).send("Failed to fetch daily challenge");
    }
  });

  // Submit challenge attempt
  app.post("/api/challenges/:id/attempt", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const challengeId = parseInt(req.params.id);
    const { answers } = req.body;

    try {
      const challenge = await db.query.dailyChallenges.findFirst({
        where: eq(dailyChallenges.id, challengeId),
      });

      if (!challenge) {
        return res.status(404).send("Challenge not found");
      }

      // Calculate score based on correct answers
      const scoredAnswers = answers.map((answer: string, index: number) => {
        const correct = answer === challenge.questions[index].correctAnswer;
        return {
          questionId: index,
          answer,
          correct,
        };
      });

      const score = scoredAnswers.filter((a: { correct: boolean }) => a.correct).length;
      const totalPoints = score * (challenge.points / challenge.questions.length);

      // Record the attempt
      await db.transaction(async (tx) => {
        await tx.insert(userChallengeAttempts).values({
          userId,
          challengeId,
          score: totalPoints,
          answers: scoredAnswers,
        });

        // Update user stats
        await tx
          .insert(userStats)
          .values({
            userId,
            totalPoints,
          })
          .onConflictDoUpdate({
            target: [userStats.userId],
            set: {
              totalPoints: sql`${userStats.totalPoints} + ${totalPoints}`,
            },
          });
      });

      res.json({
        success: true,
        score: totalPoints,
        answers: scoredAnswers,
      });
    } catch (error) {
      console.error("Error submitting challenge attempt:", error);
      res.status(500).send("Failed to submit challenge attempt");
    }
  });

  // Get challenge leaderboard
  app.get("/api/challenges/:id/leaderboard", async (req, res) => {
    const challengeId = parseInt(req.params.id);

    try {
      const leaderboard = await db
        .select({
          username: users.username,
          score: userChallengeAttempts.score,
          completedAt: userChallengeAttempts.completedAt,
        })
        .from(userChallengeAttempts)
        .innerJoin(users, eq(users.id, userChallengeAttempts.userId))
        .where(eq(userChallengeAttempts.challengeId, challengeId))
        .orderBy(desc(userChallengeAttempts.score))
        .limit(10);

      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).send("Failed to fetch leaderboard");
    }
  });

  // Get global leaderboard
  app.get("/api/leaderboard/global", async (req, res) => {
    try {
      const leaderboard = await db
        .select({
          id: users.id,
          username: users.username,
          totalPoints: userStats.totalPoints,
          weeklyXP: userStats.weeklyXP,
          monthlyXP: userStats.monthlyXP,
          streak: userStats.streak,
          globalRank: userStats.globalRank,
        })
        .from(userStats)
        .innerJoin(users, eq(users.id, userStats.userId))
        .orderBy(desc(userStats.totalPoints))
        .limit(100);

      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching global leaderboard:", error);
      res.status(500).send("Failed to fetch leaderboard");
    }
  });

  // Get user rankings by time period
  app.get("/api/leaderboard/:period", async (req, res) => {
    const period = req.params.period; // 'weekly' or 'monthly'
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const xpField = period === 'weekly' ? userStats.weeklyXP : userStats.monthlyXP;
      const rankingQuery = sql<number>`rank() over (order by ${xpField} desc)`;

      const leaderboard = await db
        .select({
          id: users.id,
          username: users.username,
          xp: xpField,
          rank: rankingQuery,
        })
        .from(userStats)
        .innerJoin(users, eq(users.id, userStats.userId))
        .orderBy(desc(xpField))
        .limit(100);

      // Get user's position if not in top 100
      const userRank = leaderboard.find(entry => entry.id === userId)?.rank;

      if (!userRank) {
        const [userPosition] = await db
          .select({
            rank: rankingQuery,
          })
          .from(userStats)
          .where(eq(userStats.userId, userId));

        if (userPosition) {
          leaderboard.push({
            id: userId,
            username: "",
            xp: 0,
            rank: userPosition.rank,
            isCurrentUser: true,
          });
        }
      }

      res.json(leaderboard);
    } catch (error) {
      console.error(`Error fetching ${period} leaderboard:`, error);
      res.status(500).send("Failed to fetch leaderboard");
    }
  });

  // New endpoint: Progress Statistics
  app.get("/api/progress/stats", async (req, res) => {
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
            .where(
              and(
                eq(userProgress.userId, userId),
                sql`date(${userProgress.completedAt}) = ${format(date, 'yyyy-MM-dd')}`
              )
            )
            .then(([result]) => ({
              date: format(date, 'yyyy-MM-dd'),
              points: result?.points || 0,
              exercises: result?.exercises || 0,
            }));
        })
      );

      // Get skill distribution
      const skillDistribution = await db
        .select({
          name: lessons.type,
          value: sql<number>`count(*)`,
        })
        .from(userProgress)
        .innerJoin(lessons, eq(lessons.id, userProgress.lessonId))
        .where(eq(userProgress.userId, userId))
        .groupBy(lessons.type);

      // Get accuracy statistics
      const accuracyStats = await db
        .select({
          total: sql<number>`count(*)`,
          correct: sql<number>`sum(case when ${userChallengeAttempts.score} > 0 then 1 else 0 end)`,
        })
        .from(userChallengeAttempts)
        .where(eq(userChallengeAttempts.userId, userId));

      // Get user stats
      const userStat = await db.query.userStats.findFirst({
        where: eq(userStats.userId, userId),
      });

      res.json({
        weeklyProgress: weeklyProgress.reverse(),
        skillDistribution,
        totalPoints: userStat?.totalPoints || 0,
        accuracy: accuracyStats[0]?.total > 0
          ? (accuracyStats[0].correct / accuracyStats[0].total * 100)
          : 0,
        streak: userStat?.streak || 0,
      });
    } catch (error) {
      console.error("Error fetching progress stats:", error);
      res.status(500).send("Failed to fetch progress statistics");
    }
  });

  // Get user's ranking stats
  app.get("/api/leaderboard/user/stats", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const userRankings = await db
        .select({
          globalRank: sql<number>`rank() over (order by ${userStats.totalPoints} desc)`,
          weeklyRank: sql<number>`rank() over (order by ${userStats.weeklyXP} desc)`,
          monthlyRank: sql<number>`rank() over (order by ${userStats.monthlyXP} desc)`,
          totalPoints: userStats.totalPoints,
          weeklyXP: userStats.weeklyXP,
          monthlyXP: userStats.monthlyXP,
        })
        .from(userStats)
        .where(eq(userStats.userId, userId));

      const [rankings] = userRankings;
      res.json(rankings || {
        globalRank: 0,
        weeklyRank: 0,
        monthlyRank: 0,
        totalPoints: 0,
        weeklyXP: 0,
        monthlyXP: 0,
      });
    } catch (error) {
      console.error("Error fetching user ranking stats:", error);
      res.status(500).send("Failed to fetch user stats");
    }
  });

  // Chat endpoint for language practice
  app.post("/api/chat", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const { message, targetLanguage } = req.body;

    if (!message || !targetLanguage) {
      return res.status(400).send("Message and target language are required");
    }

    if (!ChatService.isSupportedLanguage(targetLanguage)) {
      return res.status(400).send("Unsupported language");
    }

    try {
      const response = await ChatService.generateResponse(userId, message, targetLanguage);

      // Update user progress for using the chat feature
      await ChatService.updateUserProgress(userId, 1);

      res.json({ response });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).send("Failed to generate chat response");
    }
  });

  // Buddy System Routes
  // Update the potential buddies endpoint to use recommendation algorithm
  app.get("/api/buddies/potential", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const { language } = req.query;
    if (!language || typeof language !== "string") {
      return res.status(400).send("Language parameter is required");
    }

    try {
      const recommendedBuddies = await BuddyRecommendationService.getRecommendedBuddies(
        userId,
        language
      );

      // Get full user details for recommended buddies
      const buddyDetails = await Promise.all(
        recommendedBuddies.map(async (rec) => {
          const [buddy] = await db
            .select({
              id: users.id,
              username: users.username,
              preferences: difficultyPreferences.skillLevels,
            })
            .from(users)
            .leftJoin(
              difficultyPreferences,
              eq(difficultyPreferences.userId, users.id)
            )
            .where(eq(users.id, rec.userId));

          return {
            ...buddy,
            matchScore: rec.score,
            matchReasons: rec.matchReason,
          };
        })
      );

      res.json(buddyDetails);
    } catch (error) {
      console.error("Error finding potential buddies:", error);
      res.status(500).send("Failed to find potential buddies");
    }
  });

  app.post("/api/buddies/request", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const { buddyId, language } = req.body;
    if (!buddyId || !language) {
      return res.status(400).send("Buddy ID and language are required");
    }

    try {
      const request = await BuddyService.sendBuddyRequest(userId, buddyId, language);
      res.json(request);
    } catch (error) {
      console.error("Error sending buddy request:", error);
      res.status(500).send("Failed to send buddy request");
    }
  });

  app.post("/api/buddies/respond/:buddyId", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const buddyId = parseInt(req.params.buddyId);
    const { accept } = req.body;

    try {
      const response = await BuddyService.respondToBuddyRequest(userId, buddyId, accept);
      res.json(response);
    } catch (error) {
      console.error("Error responding to buddy request:", error);
      res.status(500).send("Failed to respond to buddy request");
    }
  });

  app.post("/api/practice-sessions", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const { participantId, language, scheduledFor, duration, topic } = req.body;
    if (!participantId || !language || !scheduledFor || !duration) {
      return res.status(400).send("Missing required session details");
    }

    try {
      const session = await BuddyService.schedulePracticeSession(
        userId,
        participantId,
        {
          language,
          scheduledFor: new Date(scheduledFor),
          duration,
          topic,
        }
      );
      res.json(session);
    } catch (error) {
      console.error("Error scheduling practice session:", error);
      res.status(500).send("Failed to schedule practice session");
    }
  });

  app.get("/api/practice-sessions/upcoming", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const sessions = await BuddyService.getUpcomingSessions(userId);
      res.json(sessions);
    } catch (error) {
      console.error("Error fetching upcoming sessions:", error);
      res.status(500).send("Failed to fetch upcoming sessions");
    }
  });

  app.post("/api/practice-sessions/:sessionId/feedback", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const sessionId = parseInt(req.params.sessionId);
    const { receiverId, rating, feedback, helpfulness } = req.body;

    if (!receiverId || !rating || !helpfulness) {
      return res.status(400).send("Missing required feedback details");
    }

    try {
      const result = await BuddyService.submitSessionFeedback(
        sessionId,
        userId,
        receiverId,
        { rating, feedback, helpfulness }
      );
      res.json(result);
    } catch (error) {
      console.error("Error submitting session feedback:", error);
      res.status(500).send("Failed to submit session feedback");
    }
  });

  app.get("/api/buddies/stats", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const stats = await BuddyService.getBuddyStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching buddy stats:", error);
      res.status(500).send("Failed to fetch buddy stats");
    }
  });

  // Get weekly challenge leaderboard
  app.get("/api/leaderboard/weekly-challenge", async (req, res) => {
    try {
      const startOfWeek = new Date();
      startOfWeek.setHours(0, 0, 0, 0);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

      const leaderboard = await db
        .select({
          id: users.id,
          username: users.username,
          weeklyXP: userStats.weeklyXP,
          weeklyRank: sql<number>`rank() over (order by ${userStats.weeklyXP} desc)`,
          challengesCompleted: sql<number>`count(distinct ${userChallengeAttempts.challengeId})`,
          averageScore: sql<number>`avg(${userChallengeAttempts.score})`,
        })
        .from(userStats)
        .innerJoin(users, eq(users.id, userStats.userId))
        .leftJoin(
          userChallengeAttempts,
          and(
            eq(userChallengeAttempts.userId, users.id),
            gte(userChallengeAttempts.completedAt, startOfWeek)
          )
        )
        .groupBy(users.id, users.username, userStats.weeklyXP)
        .orderBy(desc(userStats.weeklyXP))
        .limit(100);

      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching weekly challenge leaderboard:", error);
      res.status(500).send("Failed to fetch weekly challenge leaderboard");
    }
  });

  // Reset weekly XP at the start of each week
  app.post("/api/leaderboard/weekly-reset", async (req, res) => {
    try {
      await db
        .update(userStats)
        .set({
          weeklyXP: 0,
          lastWeeklyReset: new Date(),
        });

      res.json({ success: true });
    } catch (error) {
      console.error("Error resetting weekly XP:", error);
      res.status(500).send("Failed to reset weekly XP");
    }
  });

  // Get conversation starters
  app.get("/api/chat/starters", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const { language } = req.query;
    if (!language || typeof language !== "string") {
      return res.status(400).send("Language parameter is required");
    }

    if (!ChatService.isSupportedLanguage(language)) {
      return res.status(400).send("Unsupported language");
    }

    try {
      // Get user's skill level
      const [preferences] = await db
        .select()
        .from(difficultyPreferences)
        .where(eq(difficultyPreferences.userId, userId));

      const skillLevel = preferences?.preferredLevel || "beginner";

      const starters = await ChatService.generateConversationStarters(language, skillLevel);
      res.json(starters);
    } catch (error) {
      console.error("Error generating conversation starters:", error);
      res.status(500).send("Failed to generate conversation starters");
    }
  });

  app.get("/api/user/preferences", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const [preferences] = await db
        .select()
        .from(difficultyPreferences)
        .where(eq(difficultyPreferences.userId, userId));

      if (!preferences) {
        // Create default preferences if none exist
        const defaultPreferences = {
          userId,
          preferredLevel: "beginner",
          adaptiveMode: true,
          skillLevels: {
            vocabulary: 1,
            grammar: 1,
            pronunciation: 1,
            comprehension: 1
          }
        };

        const [newPreferences] = await db
          .insert(difficultyPreferences)
          .values(defaultPreferences)
          .returning();

        return res.json(newPreferences);
      }

      res.json(preferences);
    } catch (error) {
      console.error("Error fetching user preferences:", error);
      res.status(500).send("Failed to fetch user preferences");
    }
  });

  // Add these routes after the existing authentication routes
  // Generate flashcards
  app.post("/api/flashcards/generate", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const { text, language, count } = req.body;

    try {
      // Call Perplexity API to extract vocabulary and generate flashcards
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-sonar-small-128k-online",
          messages: [
            {
              role: "system",
              content: `Extract ${count} most important vocabulary items from the text and create flashcards. 
                       For each word provide: term, definition, context, and 2 example sentences.
                       Format as JSON array.`
            },
            {
              role: "user",
              content: text
            }
          ],
          temperature: 0.2
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();
      const flashcardsData = JSON.parse(result.choices[0].message.content);

      // Save generated flashcards to database
      const flashcardPromises = flashcardsData.map((card: any) =>
        db.insert(flashcards).values({
          userId,
          term: card.term,
          definition: card.definition,
          context: card.context,
          examples: card.examples,
          language,
          difficulty: 1.0,
          createdAt: new Date(),
          lastReviewed: new Date(),
          nextReview: new Date(Date.now() + 24 * 60 * 60 * 1000), // Review in 24 hours
        })
      );

      await Promise.all(flashcardPromises);

      res.json(flashcardsData);
    } catch (error) {
      console.error("Error generating flashcards:", error);
      res.status(500).send("Failed to generate flashcards");
    }
  });

  // Flashcard Routes
  app.post("/api/flashcards", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const { term, definition, context, examples, language, tags } = req.body;

    try {
      const [flashcard] = await db
        .insert(flashcards)
        .values({
          userId,
          term,
          definition,
          context,
          examples,
          language,
          tags,
          difficulty: 1.0,
          createdAt: new Date(),
        })
        .returning();

      res.json(flashcard);
    } catch (error) {
      console.error("Error creating flashcard:", error);
      res.status(500).send("Failed to create flashcard");
    }
  });

  app.get("/api/flashcards", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const { language } = req.query;

    try {
      const userFlashcards = await db
        .select()
        .from(flashcards)
        .where(eq(flashcards.userId, userId))
        .orderBy(desc(flashcards.createdAt));

      res.json(userFlashcards);
    } catch (error) {
      console.error("Error fetching flashcards:", error);
      res.status(500).send("Failed to fetch flashcards");
    }
  });

  // Flashcard routes with proper error handling and logging
  app.get("/api/flashcards/review", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const now = new Date();
      const dueCards = await db.query.flashcards.findMany({
        where: and(
          eq(flashcards.userId, userId),
          or(
            eq(flashcards.nextReview, null),
            lte(flashcards.nextReview, now)
          )
        ),
        orderBy: [
          asc(flashcards.nextReview),
          desc(flashcards.proficiency)
        ],
        limit: 20
      });

      logger.info('Retrieved due flashcards', {
        userId,
        cardCount: dueCards.length,
        timestamp: now
      });

      res.json(dueCards);
    } catch (error) {
      logger.error('Error retrieving flashcards', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
      res.status(500).send("Failed to retrieve flashcards");
    }
  });

  app.post("/api/flashcards/:id/progress", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const flashcardId = parseInt(req.params.id);
    const { quality, responseTime } = req.body;

    if (typeof quality !== 'number' || quality < 0 || quality > 5) {
      return res.status(400).send("Invalid quality rating");
    }

    try {
      const flashcard = await db.query.flashcards.findFirst({
        where: and(
          eq(flashcards.id, flashcardId),
          eq(flashcards.userId, userId)
        )
      });

      if (!flashcard) {
        return res.status(404).send("Flashcard not found");
      }

      const srs = SpacedRepetitionService.calculateNextReview(
        quality,
        flashcard.easeFactor || 2.5,
        flashcard.intervalDays || 1,
        flashcard.consecutiveCorrect || 0
      );

      // Calculate new difficulty based on performance
      const newDifficulty = SpacedRepetitionService.calculateNewDifficulty(
        flashcard.difficulty,
        quality,
        responseTime
      );

      await db.transaction(async (tx) => {
        // Update flashcard
        await tx
          .update(flashcards)
          .set({
            easeFactor: srs.easeFactor,
            intervalDays: srs.intervalDays,
            nextReview: srs.nextReview,
            lastReviewed: new Date(),
            difficulty: newDifficulty,
            proficiency: quality >= 4 ? (flashcard.proficiency || 0) + 1 : 0,
            consecutiveCorrect: quality >= 3 ? (flashcard.consecutiveCorrect || 0) + 1 : 0
          })
          .where(eq(flashcards.id, flashcardId));

        // Record progress
        await tx
          .insert(flashcardProgress)
          .values({
            userId,
            flashcardId,
            quality,
            responseTime,
            easeFactor: srs.easeFactor,
            intervalDays: srs.intervalDays,
            correct: quality >= 3
          });
      });

      logger.info('Recorded flashcard progress', {
        userId,
        flashcardId,
        quality,
        newInterval: srs.intervalDays,
        timestamp: new Date()
      });

      res.json({ success: true, nextReview: srs.nextReview });
    } catch (error) {
      logger.error('Error updating flashcard progress', {
        userId,
        flashcardId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
      res.status(500).send("Failed to update progress");
    }
  });

  // Register learning path routes
  app.use(learningPathRouter);

  // Community Board endpoints
  app.get("/api/community/posts", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const posts = await db
        .select({
          id: communityPosts.id,
          userId: communityPosts.userId,
          username: users.username,
          userAvatar: users.avatar,
          content: communityPosts.content,
          targetLanguage: communityPosts.targetLanguage,
          nativeLanguage: sql<string>`(
            SELECT language_code
            FROM user_languages
            WHERE user_id = ${communityPosts.userId}
            AND is_native = true
            LIMIT 1
          )`,
          tags: communityPosts.tags,
          likes: sql<number>`count(distinct ${postLikes.id})`,
          comments: sql<number>`count(distinct ${postComments.id})`,
          createdAt: communityPosts.createdAt,
        })
        .from(communityPosts)
        .leftJoin(postLikes, eq(postLikes.postId, communityPosts.id))
        .leftJoin(postComments, eq(postComments.postId, communityPosts.id))
        .innerJoin(users, eq(users.id, communityPosts.userId))
        .groupBy(
          communityPosts.id,
          users.username,
          users.avatar,
        )
        .orderBy(desc(communityPosts.createdAt))
        .limit(50);

      logger.info('Retrieved community posts', {
        userId,
        postCount: posts.length,
        timestamp: new Date()
      });

      res.json(posts);
    } catch (error) {
      logger.error('Error retrieving community posts', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
      res.status(500).send("Failed to retrieve community posts");
    }
  });

  app.post("/api/community/posts", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const { content, targetLanguage, tags } = req.body;

    if (!content?.trim()) {
      return res.status(400).send("Content is required");
    }

    try {
      const [post] = await db
        .insert(communityPosts)
        .values({
          userId,
          content,
          targetLanguage,
          tags,
        })
        .returning();

      logger.info('Created community post', {
        userId,
        postId: post.id,
        timestamp: new Date()
      });

      res.json(post);
    } catch (error) {
      logger.error('Error creating community post', {
        userId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
      res.status(500).send("Failed to create post");
    }
  });

  app.post("/api/community/posts/:id/like", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const postId = parseInt(req.params.id);

    try {
      // Check if the post exists
      const post = await db.query.communityPosts.findFirst({
        where: eq(communityPosts.id, postId),
      });

      if (!post) {
        return res.status(404).send("Post not found");
      }

      // Toggle like status
      const existingLike = await db.query.postLikes.findFirst({
        where: and(
          eq(postLikes.userId, userId),
          eq(postLikes.postId, postId)
        ),
      });

      if (existingLike) {
        await db
          .delete(postLikes)
          .where(
            and(
              eq(postLikes.userId, userId),
              eq(postLikes.postId, postId)
            )
          );
      } else {
        await db
          .insert(postLikes)
          .values({
            userId,
            postId,
          });
      }

      logger.info('Toggled post like', {
        userId,
        postId,
        action: existingLike ? 'unliked' : 'liked',
        timestamp: new Date()
      });

      res.json({ success: true, liked: !existingLike });
    } catch (error) {
      logger.error('Error toggling post like', {
        userId,
        postId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
      res.status(500).send("Failed to update like status");
    }
  });

  app.post("/api/community/posts/:id/comments", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const postId = parseInt(req.params.id);
    const { content } = req.body;

    if (!content?.trim()) {
      return res.status(400).send("Comment content is required");
    }

    try {
      const post = await db.query.communityPosts.findFirst({
        where: eq(communityPosts.id, postId),
      });

      if (!post) {
        return res.status(404).send("Post not found");
      }

      const [comment] = await db
        .insert(postComments)
        .values({
          userId,
          postId,
          content,
        })
        .returning();

      logger.info('Created post comment', {
        userId,
        postId,
        commentId: comment.id,
        timestamp: new Date()
      });

      res.json(comment);
    } catch (error) {
      logger.error('Error creating post comment', {
        userId,
        postId,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date()
      });
      res.status(500).send("Failed to create comment");
    }
  });

  // Quiz routes
  app.post("/api/quizzes/generate", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const { language } = req.body;

    try {
      // Get adaptive parameters based on user's performance
      const params = await QuizGeneratorService.getAdaptiveQuizParameters(userId, language);

      // Generate a new quiz
      const quiz = await QuizGeneratorService.createQuiz(
        language,
        params.difficulty,
        params.type
      );

      logger.info('Generated new quiz', {
        userId,
        quizId: quiz.id,
        language,
        difficulty: params.difficulty,
        type: params.type
      });

      res.json(quiz);
    } catch (error) {
      logger.error('Error generating quiz', {
        userId,
        language,
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).send("Failed to generate quiz");
    }
  });

  app.get("/api/quizzes/:id", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const quiz = await db.query.quizzes.findFirst({
        where: eq(quizzes.id, parseInt(req.params.id)),
      });

      if (!quiz) {
        return res.status(404).send("Quiz not found");
      }

      res.json(quiz);
    } catch (error) {
      logger.error('Error fetching quiz', {
        userId,
        quizId: req.params.id,
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).send("Failed to fetch quiz");
    }
  });

  app.post("/api/quizzes/:id/attempt", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const quizId = parseInt(req.params.id);
    const { answers, score } = req.body;

    try {
      const quiz = await db.query.quizzes.findFirst({
        where: eq(quizzes.id, quizId),
      });

      if (!quiz) {
        return res.status(404).send("Quiz not found");
      }

      const maxScore = quiz.questions.reduce(
        (sum, q) => sum + q.points,
        0
      );

      const [attempt] = await db
        .insert(quizAttempts)
        .values({
          userId,
          quizId,
          score,
          maxScore,
          answers,
        })
        .returning();

      logger.info('Recorded quiz attempt', {
        userId,
        quizId,
        attemptId: attempt.id,
        score,
        maxScore
      });

      res.json(attempt);
    } catch (error) {
      logger.error('Error recording quiz attempt', {
        userId,
        quizId,
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).send("Failed to record quiz attempt");
    }
  });

  app.get("/api/pronunciation-challenges", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      // Fetch challenges based on user's current level and preferences
      const challenges = [
        {
          id: 1,
          text: "The quick brown fox jumps over the lazy dog",
          language: "en",
          difficulty: 1,
          points: 100,
        },
        {
          id: 2,
          text: "She sells seashells by the seashore",
          language: "en",
          difficulty: 2,
          points: 200,
        },
        {
          id: 3,
          text: "Peter Piper picked a peck of pickled peppers",
          language: "en",
          difficulty: 3,
          points: 300,
        },
      ];

      res.json(challenges);
    } catch (error) {
      console.error("Error fetching pronunciation challenges:", error);
      res.status(500).send("Failed to fetch challenges");
    }
  });

  // Flashcard System Routes
  app.get("/api/flashcards", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const userFlashcards = await db.query.flashcards.findMany({
        where: eq(flashcards.userId, userId),
        orderBy: desc(flashcards.createdAt),
      });

      res.json(userFlashcards);
    } catch (error) {
      console.error("Error fetching flashcards:", error);
      res.status(500).send("Failed to fetch flashcards");
    }
  });

  app.get("/api/flashcards/review", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      // Get cards that are due for review based on spaced repetition
      const dueCards = await db
        .select({
          ...flashcards,
          progress: {
            easeFactor: flashcardProgress.easeFactor,
            interval: flashcardProgress.interval,
            consecutiveCorrect: flashcardProgress.consecutiveCorrect,
          },
        })
        .from(flashcards)
        .leftJoin(
          flashcardProgress,
          and(
            eq(flashcardProgress.flashcardId, flashcards.id),
            eq(flashcardProgress.userId, userId)
          )
        )
        .where(
          and(
            eq(flashcards.userId, userId),
            or(
              eq(flashcards.lastReviewed, null),
              lte(flashcards.nextReview, new Date())
            )
          )
        )
        .limit(10);

      res.json(dueCards);
    } catch (error) {
      console.error("Error fetching review cards:", error);
      res.status(500).send("Failed to fetch review cards");
    }
  });

  app.post("/api/flashcards", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const { front, back, translation, imageUrl, language, category, tags, multipleChoiceOptions } = req.body;

    try {
      const [newCard] = await db
        .insert(flashcards)
        .values({
          front,
          back,
          translation,
          imageUrl,
          language,
          category,
          tags,
          multipleChoiceOptions,
          userId,
        })
        .returning();

      res.json(newCard);
    } catch (error) {
      console.error("Error creating flashcard:", error);
      res.status(500).send("Failed to create flashcard");
    }
  });

  app.post("/api/flashcards/:id/review", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const flashcardId = parseInt(req.params.id);
    const { correct, selectedOption } = req.body;

    try {
      await db.transaction(async (tx) => {
        // Get current progress
        const [currentProgress] = await tx
          .select()
          .from(flashcardProgress)
          .where(
            and(
              eq(flashcardProgress.userId, userId),
              eq(flashcardProgress.flashcardId, flashcardId)
            )
          );

        // Calculate new spaced repetition values
        let easeFactor = currentProgress?.easeFactor || 2.5;
        let interval = currentProgress?.interval || 1;
        let consecutiveCorrect = currentProgress?.consecutiveCorrect || 0;

        if (correct) {
          consecutiveCorrect++;
          interval = Math.round(interval * easeFactor);
          easeFactor = Math.min(easeFactor + 0.1, 2.5);
        } else {
          consecutiveCorrect = 0;
          interval = 1;
          easeFactor = Math.max(easeFactor - 0.2, 1.3);
        }

        // Calculate next review date
        const nextReview = addDays(new Date(), interval);

        // Update or create progress record
        await tx
          .insert(flashcardProgress)
          .values({
            userId,
            flashcardId,
            easeFactor,
            interval,
            consecutiveCorrect,
            nextReviewAt: nextReview,
          })
          .onConflictDoUpdate({
            target: [flashcardProgress.userId, flashcardProgress.flashcardId],
            set: {
              easeFactor,
              interval,
              consecutiveCorrect,
              nextReviewAt: nextReview,
              lastReviewedAt: new Date(),
            },
          });

        // Update flashcard record
        await tx
          .update(flashcards)
          .set({
            lastReviewed: new Date(),
            nextReview,
            wrongAttempts: sql`CASE WHEN ${!correct} THEN wrong_attempts + 1 ELSE wrong_attempts END`,
          })
          .where(eq(flashcards.id, flashcardId));
      });

      res.json({ success: true, correct });
    } catch (error) {
      console.error("Error updating flashcard review:", error);
      res.status(500).send("Failed to update flashcard review");
    }
  });

  return httpServer;
}