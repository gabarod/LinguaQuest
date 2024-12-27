import { Router } from "express";
import { db } from "@db";
import {
  learningPaths,
  aiRecommendations,
  skillProgression,
  lessons,
  userProgress,
} from "@db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

// Get user's learning path and progress
router.get("/api/learning-path", async (req, res) => {
  if (!req.user) {
    return res.status(401).send("Not authenticated");
  }

  try {
    // Get user's learning path
    const [userPath] = await db
      .select()
      .from(learningPaths)
      .where(eq(learningPaths.userId, req.user.id))
      .limit(1);

    if (!userPath) {
      return res.status(404).send("Learning path not found");
    }

    // Get skill progression for visualization
    const skills = await db
      .select()
      .from(skillProgression)
      .where(
        and(
          eq(skillProgression.userId, req.user.id),
          eq(skillProgression.pathId, userPath.id)
        )
      );

    // Get completed lessons
    const progress = await db
      .select()
      .from(userProgress)
      .where(eq(userProgress.userId, req.user.id));

    // Calculate overall progress
    const completedLessons = progress.filter((p) => p.completed).length;
    const totalLessons = await db.select().from(lessons).execute();
    const progressPercentage = (completedLessons / totalLessons.length) * 100;

    // Transform lessons into learning path nodes
    const nodes = totalLessons.map((lesson) => {
      const lessonProgress = progress.find((p) => p.lessonId === lesson.id);
      const skill = skills.find((s) => s.skill === lesson.type);

      return {
        id: lesson.id,
        title: lesson.title,
        type: lesson.type,
        status: lessonProgress?.completed
          ? "completed"
          : lesson.id <= completedLessons + 1
          ? "available"
          : "locked",
        skillFocus: [lesson.type],
        difficulty: lesson.difficulty,
        estimatedTime: lesson.duration,
        prerequisites: [], // TODO: Implement prerequisites
        confidence: skill?.confidence ?? 0,
      };
    });

    res.json({
      nodes,
      currentLevel: userPath.currentLevel,
      targetLevel: userPath.targetLevel,
      progress: progressPercentage,
    });
  } catch (error) {
    console.error("Error fetching learning path:", error);
    res.status(500).send("Internal server error");
  }
});

// Get AI recommendations
router.get("/api/recommendations", async (req, res) => {
  if (!req.user) {
    return res.status(401).send("Not authenticated");
  }

  try {
    // Get user's current recommendations
    const currentRecommendations = await db
      .select()
      .from(aiRecommendations)
      .where(
        and(
          eq(aiRecommendations.userId, req.user.id),
          eq(aiRecommendations.status, "pending")
        )
      );

    // If we have recent recommendations, return them
    if (currentRecommendations.length > 0) {
      return res.json(currentRecommendations);
    }

    // Get user's learning path and progress for AI analysis
    const [userPath] = await db
      .select()
      .from(learningPaths)
      .where(eq(learningPaths.userId, req.user.id))
      .limit(1);

    const skills = await db
      .select()
      .from(skillProgression)
      .where(
        and(
          eq(skillProgression.userId, req.user.id),
          eq(skillProgression.pathId, userPath.id)
        )
      );

    // Generate recommendations using Perplexity AI
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-sonar-small-128k-online",
        messages: [
          {
            role: "system",
            content:
              "You are an AI language learning advisor. Analyze the user's progress and generate personalized recommendations.",
          },
          {
            role: "user",
            content: JSON.stringify({
              currentLevel: userPath.currentLevel,
              targetLevel: userPath.targetLevel,
              learningStyle: userPath.learningStyle,
              skills: skills.map((s) => ({
                name: s.skill,
                level: s.level,
                confidence: s.confidence,
              })),
            }),
          },
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate recommendations");
    }

    const aiResponse = await response.json();
    const recommendations = JSON.parse(aiResponse.choices[0].message.content);

    // Save and return the new recommendations
    const savedRecommendations = await db
      .insert(aiRecommendations)
      .values(
        recommendations.map((rec: any) => ({
          userId: req.user!.id,
          pathId: userPath.id,
          type: rec.type,
          priority: rec.priority,
          reason: rec.reason,
          metadata: rec.metadata,
          status: "pending",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        }))
      )
      .returning();

    res.json(savedRecommendations);
  } catch (error) {
    console.error("Error generating recommendations:", error);
    res.status(500).send("Internal server error");
  }
});

export default router;
