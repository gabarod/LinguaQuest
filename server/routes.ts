import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { sql } from "drizzle-orm";
import { lessons, exercises, userProgress, userStats, milestones, userMilestones, dailyChallenges, userChallengeAttempts, users, flashcards, flashcardProgress } from "@db/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { format, subDays } from "date-fns";
import { ChatService } from "./services/chatService";
import { BuddyService } from "./services/buddyService";
import multer from "multer";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

// Add logging for flashcard operations
const logFlashcardOperation = (operation: string, details: any) => {
  console.log(`[Flashcard ${operation}]:`, JSON.stringify(details, null, 2));
};

export function registerRoutes(app: Express): Server {
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
      // Prepare the form data for the AI API
      const formData = new FormData();
      const audioBlob = new Blob([req.file.buffer], { type: req.file.mimetype });
      formData.append("audio", audioBlob);
      formData.append("text", req.body.text);
      formData.append("language", req.body.language);

      // Call the AI API for pronunciation analysis
      const response = await fetch("https://api.perplexity.ai/audio/pronunciation", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const analysis = await response.json();

      // Process and format the analysis results
      const feedback = {
        score: analysis.score * 100,
        feedback: analysis.feedback,
        correctPhonemes: analysis.phonemes.correct,
        incorrectPhonemes: analysis.phonemes.incorrect,
      };

      // Save the analysis results for tracking progress
      await db.insert(userProgress).values({
        userId,
        type: "pronunciation",
        score: feedback.score,
        details: feedback,
        completedAt: new Date(),
      });

      res.json(feedback);
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
      const potentialBuddies = await BuddyService.findPotentialBuddies(userId, language);
      res.json(potentialBuddies);
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

  // Generate vocabulary flashcards
  app.post("/api/flashcards/generate", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const { text, language, count = 5 } = req.body;
    if (!text || !language) {
      return res.status(400).send("Text and language are required");
    }

    try {
      logFlashcardOperation("generation-start", { userId, language, count });

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
              content: `You are a language learning expert. Generate ${count} vocabulary flashcards in ${language} from the given text. For each word, provide:
              1. The term in the target language
              2. Its definition in English
              3. Example sentences
              4. Usage context
              Format as JSON array.`
            },
            {
              role: "user",
              content: text
            }
          ],
          temperature: 0.2,
        })
      });

      if (!response.ok) {
        const error = await response.text();
        logFlashcardOperation("api-error", { status: response.status, error });
        throw new Error(`API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const flashcardsData = JSON.parse(data.choices[0].message.content);
      logFlashcardOperation("api-response", { count: flashcardsData.length });

      // Save generated flashcards to database
      const savedFlashcards = await Promise.all(
        flashcardsData.map(async (card: any) => {
          const [savedCard] = await db            .insert(flashcards)
            .values({
              userId,
              term: card.term,
              definition: card.definition,
              context: card.context,
              examples: card.examples,
              language,
              tags: card.tags || [],
              nextReview: new Date(Date.now() + 24 * 60 * 60 * 1000),
              proficiency: 0,
              lastReviewed: null
            })
            .returning();
          return savedCard;
        })
      );

      logFlashcardOperation("generation-complete", { count: savedFlashcards.length });
      res.json(savedFlashcards);
    } catch (error) {
      logFlashcardOperation("error", { error: error instanceof Error ? error.message : "Unknown error" });
      console.error("Error generating flashcards:", error);
      res.status(500).send("Failed to generate flashcards");
    }
  });

  // Get user's flashcards
  app.get("/api/flashcards", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const { language, dueOnly } = req.query;
    try {
      let query = db
        .select()
        .from(flashcards)
        .where(eq(flashcards.userId, userId));

      if (language) {
        query = query.where(eq(flashcards.language, language as string));
      }

      if (dueOnly === 'true') {
        query = query.where(lte(flashcards.nextReview, new Date()));
      }

      const userFlashcards = await query.orderBy(flashcards.nextReview);
      res.json(userFlashcards);
    } catch (error) {
      console.error("Error fetching flashcards:", error);
      res.status(500).send("Failed to fetch flashcards");
    }
  });

  // Update flashcard review progress
  app.post("/api/flashcards/:id/review", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    const { correct, responseTime } = req.body;
    const flashcardId = parseInt(req.params.id);

    try {
      await db.transaction(async (tx) => {
        // Record progress
        await tx.insert(flashcardProgress).values({
          userId,
          flashcardId,
          correct,
          responseTime,
        });

        // Update flashcard
        const [flashcard] = await tx
          .select()
          .from(flashcards)
          .where(
            and(
              eq(flashcards.id, flashcardId),
              eq(flashcards.userId, userId)
            )
          );

        if (!flashcard) {
          throw new Error("Flashcard not found");
        }

        // Calculate next review time using spaced repetition
        const proficiency = Math.min(5, flashcard.proficiency + (correct ? 1 : -1));
        const interval = Math.pow(2, proficiency) * 24 * 60 * 60 * 1000; // hours to milliseconds
        const nextReview = new Date(Date.now() + interval);

        await tx
          .update(flashcards)
          .set({
            proficiency,
            lastReviewed: new Date(),
            nextReview,
          })
          .where(eq(flashcards.id, flashcardId));
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating flashcard progress:", error);
      res.status(500).send("Failed to update flashcard progress");
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

  const httpServer = createServer(app);
  return httpServer;
}