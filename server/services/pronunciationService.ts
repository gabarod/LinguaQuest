import { performanceMetrics, pronunciationAttempts, pronunciationMetrics } from "@db/schema";
import { db } from "@db";
import { decimal } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

interface PronunciationAnalysis {
  score: number;
  feedback: string[];
  correctPhonemes: string[];
  incorrectPhonemes: string[];
  suggestions: string[];
}

export class PronunciationService {
  static async analyzePronunciation(
    audioData: Buffer,
    text: string,
    language: string
  ): Promise<PronunciationAnalysis> {
    try {
      // Create form data for the API request
      const formData = new FormData();
      const audioBlob = new Blob([audioData], { type: 'audio/wav' });
      formData.append('audio', audioBlob);
      formData.append('text', text);
      formData.append('language', language);
      formData.append('model', 'llama-3.1-sonar-small-128k-online');

      // Call Perplexity AI API for pronunciation analysis
      const response = await fetch("https://api.perplexity.ai/audio/speech-to-text", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const transcription = await response.json();

      // Now analyze the pronunciation using chat completion
      const analysisResponse = await fetch("https://api.perplexity.ai/chat/completions", {
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
              content: "You are a language pronunciation expert. Analyze the pronunciation differences between the target text and actual spoken text. Provide detailed feedback on phonemes, accuracy, and suggestions for improvement."
            },
            {
              role: "user",
              content: `Compare pronunciation: Target text: "${text}" vs Spoken text: "${transcription.text}". Language: ${language}`
            }
          ],
          temperature: 0.2
        })
      });

      if (!analysisResponse.ok) {
        throw new Error(`Analysis API error: ${analysisResponse.status}`);
      }

      const analysis = await analysisResponse.json();

      // Process the analysis to extract phoneme-level feedback
      const similarity = this.calculateSimilarity(text.toLowerCase(), transcription.text.toLowerCase());
      const phonemeAnalysis = this.analyzePhonemes(text, transcription.text);

      // Generate feedback based on the analysis
      const result: PronunciationAnalysis = {
        score: similarity * 100,
        feedback: this.generateFeedback(analysis.choices[0].message.content),
        correctPhonemes: phonemeAnalysis.correct,
        incorrectPhonemes: phonemeAnalysis.incorrect,
        suggestions: this.extractSuggestions(analysis.choices[0].message.content)
      };

      return result;
    } catch (error) {
      console.error("Error analyzing pronunciation:", error);
      throw error;
    }
  }

  private static calculateSimilarity(target: string, actual: string): number {
    // Simple Levenshtein distance-based similarity
    const maxLength = Math.max(target.length, actual.length);
    const distance = this.levenshteinDistance(target, actual);
    return 1 - (distance / maxLength);
  }

  private static levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(
            dp[i - 1][j],     // deletion
            dp[i][j - 1],     // insertion
            dp[i - 1][j - 1]  // substitution
          );
        }
      }
    }

    return dp[m][n];
  }

  private static analyzePhonemes(target: string, actual: string): { correct: string[], incorrect: string[] } {
    // Split words into phoneme-like units (simplified for example)
    const targetPhonemes = target.toLowerCase().split(' ');
    const actualPhonemes = actual.toLowerCase().split(' ');

    const correct: string[] = [];
    const incorrect: string[] = [];

    targetPhonemes.forEach((phoneme, index) => {
      if (actualPhonemes[index] === phoneme) {
        correct.push(phoneme);
      } else {
        incorrect.push(phoneme);
      }
    });

    return { correct, incorrect };
  }

  private static generateFeedback(analysisContent: string): string[] {
    const feedback: string[] = [];

    // Extract feedback points from the analysis
    const sentences = analysisContent.split(/[.!?]+/).filter(s => s.trim().length > 0);

    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      if (trimmed.includes("improve") || trimmed.includes("practice") || trimmed.includes("focus")) {
        feedback.push(trimmed);
      }
    });

    // Add default feedback if none extracted
    if (feedback.length === 0) {
      feedback.push("Focus on clear pronunciation");
      feedback.push("Practice speaking at a comfortable pace");
    }

    return feedback;
  }

  private static extractSuggestions(analysisContent: string): string[] {
    const suggestions: string[] = [];

    // Extract specific suggestions from the analysis
    const sentences = analysisContent.split(/[.!?]+/).filter(s => s.trim().length > 0);

    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      if (trimmed.toLowerCase().includes("try") || trimmed.toLowerCase().includes("suggest")) {
        suggestions.push(trimmed);
      }
    });

    return suggestions;
  }

  static async savePronunciationAttempt(
    userId: number,
    exerciseId: number | null,
    targetText: string,
    language: string,
    analysis: PronunciationAnalysis
  ) {
    const [attempt] = await db.insert(pronunciationAttempts).values({
      userId,
      exerciseId,
      targetText,
      language,
      score: analysis.score.toString(),
      feedback: {
        overall: analysis.score,
        phonemes: analysis.incorrectPhonemes.map(p => ({
          phoneme: p,
          score: 0, // Could be calculated more precisely
          feedback: "Needs improvement"
        })),
        suggestions: analysis.suggestions
      }
    }).returning();

    // Update overall metrics
    await this.updatePronunciationMetrics(userId, language, analysis.score);

    return attempt;
  }

  private static async updatePronunciationMetrics(
    userId: number,
    language: string,
    score: number
  ) {
    const [existingMetrics] = await db
      .select()
      .from(pronunciationMetrics)
      .where(sql`${pronunciationMetrics.userId} = ${userId} AND ${pronunciationMetrics.language} = ${language}`)
      .limit(1);

    if (existingMetrics) {
      const newAverage = (existingMetrics.averageScore * existingMetrics.totalAttempts + score) / (existingMetrics.totalAttempts + 1);
      const improvementRate = ((score - existingMetrics.averageScore) / existingMetrics.averageScore) * 100;

      await db
        .update(pronunciationMetrics)
        .set({
          averageScore: newAverage.toString(),
          totalAttempts: existingMetrics.totalAttempts + 1,
          improvementRate: improvementRate.toString(),
          lastUpdated: new Date()
        })
        .where(sql`${pronunciationMetrics.id} = ${existingMetrics.id}`);
    } else {
      await db.insert(pronunciationMetrics).values({
        userId,
        language,
        averageScore: score.toString(),
        totalAttempts: 1,
        lastUpdated: new Date()
      });
    }
  }
  static async savePronunciationMetrics(
    userId: number,
    exerciseId: number,
    score: number
  ) {
    await db.insert(performanceMetrics).values({
      userId,
      exerciseId,
      accuracy: score.toString(),
      responseTime: 0,
      attemptCount: 1,
      timestamp: new Date()
    });
  }
}