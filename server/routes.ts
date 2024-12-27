import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { db } from "@db";
import { sql } from "drizzle-orm";
import { lessons, exercises, userProgress, userStats, milestones, userMilestones, dailyChallenges, userChallengeAttempts } from "@db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { format, subDays } from "date-fns";
import { users } from "@db/schema";


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
        .orderBy(sql`${userChallengeAttempts.score} DESC`)
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
        .from(users)
        .innerJoin(userStats, eq(users.id, userStats.userId))
        .orderBy(sql`${userStats.totalPoints} DESC`)
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
      const leaderboard = await db
        .select({
          id: users.id,
          username: users.username,
          xp: period === 'weekly' ? userStats.weeklyXP : userStats.monthlyXP,
          rank: sql<number>`rank() over (order by ${
            period === 'weekly' ? userStats.weeklyXP : userStats.monthlyXP
          } desc)`,
        })
        .from(users)
        .innerJoin(userStats, eq(users.id, userStats.userId))
        .orderBy(
          period === 'weekly' ? userStats.weeklyXP : userStats.monthlyXP,
          'desc'
        )
        .limit(100);

      // Get user's position if not in top 100
      const userRank = leaderboard.find(entry => entry.id === userId)?.rank;

      if (!userRank) {
        const [userPosition] = await db
          .select({
            rank: sql<number>`rank() over (order by ${
              period === 'weekly' ? userStats.weeklyXP : userStats.monthlyXP
            } desc)`,
          })
          .from(userStats)
          .where(eq(userStats.userId, userId));

        if (userPosition) {
          leaderboard.push({
            id: userId,
            username: null, //No username needed, this is just a rank
            xp: null,
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

  // Get user's ranking stats
  app.get("/api/leaderboard/user/stats", async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).send("Not authenticated");
    }

    try {
      const [userStats] = await db
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

      res.json(userStats);
    } catch (error) {
      console.error("Error fetching user ranking stats:", error);
      res.status(500).send("Failed to fetch user stats");
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}