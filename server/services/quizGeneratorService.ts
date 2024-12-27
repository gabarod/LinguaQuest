import { z } from "zod";
import { db } from "@db";
import { quizzes, users, type languages } from "@db/schema";
import type { SupportedLanguage } from "@db/schema";
import { logger } from "./loggingService";

const quizQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  correctAnswer: z.string(),
  explanation: z.string(),
});

type QuizQuestion = z.infer<typeof quizQuestionSchema>;

export class QuizGeneratorService {
  private static async generateQuestions(
    language: SupportedLanguage,
    difficulty: string,
    type: string,
    count: number
  ): Promise<QuizQuestion[]> {
    const prompt = `Generate ${count} ${difficulty} level ${type} questions for learning ${language}. Format as JSON array with properties: question, options (array of 4 choices), correctAnswer (one of the options), and explanation. Questions should be engaging and game-like.`;

    try {
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: "llama-3.1-sonar-small-128k-online",
          messages: [
            {
              role: "system",
              content: "You are a language learning expert specialized in creating engaging educational content."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate quiz questions: ${response.statusText}`);
      }

      const data = await response.json();
      const questionData = JSON.parse(data.choices[0].message.content);
      
      const questions = z.array(quizQuestionSchema).parse(questionData);
      return questions.map((q, idx) => ({
        ...q,
        id: idx + 1,
        points: Math.floor(100 / count)
      }));
    } catch (error) {
      logger.error('Error generating quiz questions', {
        error: error instanceof Error ? error.message : String(error),
        language,
        difficulty,
        type
      });
      throw new Error('Failed to generate quiz questions');
    }
  }

  static async createQuiz(
    language: SupportedLanguage,
    difficulty: string,
    type: string,
    title?: string
  ) {
    try {
      const questions = await this.generateQuestions(language, difficulty, type, 5);
      
      const [quiz] = await db.insert(quizzes).values({
        title: title || `${language} ${type} Quiz - ${difficulty}`,
        description: `Test your ${language} ${type} skills at ${difficulty} level`,
        language,
        difficulty,
        type,
        questions,
        timeLimit: 300, // 5 minutes
      }).returning();

      logger.info('Created new quiz', {
        quizId: quiz.id,
        language,
        difficulty,
        type
      });

      return quiz;
    } catch (error) {
      logger.error('Error creating quiz', {
        error: error instanceof Error ? error.message : String(error),
        language,
        difficulty,
        type
      });
      throw error;
    }
  }

  static async getAdaptiveQuizParameters(userId: number, language: SupportedLanguage) {
    try {
      // Get user's recent quiz attempts
      const recentAttempts = await db.query.quizAttempts.findMany({
        where: (attempts) => ({
          userId: attempts.userId.equals(userId)
        }),
        orderBy: (attempts) => attempts.completedAt,
        limit: 5,
        with: {
          quiz: true
        }
      });

      // Calculate average score and determine appropriate difficulty
      const averageScore = recentAttempts.reduce((sum, attempt) => 
        sum + (attempt.score / attempt.maxScore), 0) / (recentAttempts.length || 1);

      let difficulty;
      if (averageScore < 0.4) difficulty = "beginner";
      else if (averageScore < 0.7) difficulty = "intermediate";
      else difficulty = "advanced";

      // Determine quiz type based on user's performance in different areas
      const typePerformance = recentAttempts.reduce((acc, attempt) => {
        const type = attempt.quiz.type;
        const score = attempt.score / attempt.maxScore;
        acc[type] = acc[type] || { total: 0, count: 0 };
        acc[type].total += score;
        acc[type].count++;
        return acc;
      }, {} as Record<string, { total: number, count: number }>);

      // Choose the type where user needs most improvement
      let lowestPerformanceType = "vocabulary";
      let lowestScore = 1;
      
      Object.entries(typePerformance).forEach(([type, { total, count }]) => {
        const averageTypeScore = total / count;
        if (averageTypeScore < lowestScore) {
          lowestScore = averageTypeScore;
          lowestPerformanceType = type;
        }
      });

      return {
        difficulty,
        type: lowestPerformanceType
      };
    } catch (error) {
      logger.error('Error determining adaptive quiz parameters', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        language
      });
      return {
        difficulty: "beginner",
        type: "vocabulary"
      };
    }
  }
}
