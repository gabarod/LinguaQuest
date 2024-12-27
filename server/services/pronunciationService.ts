import { performanceMetrics } from "@db/schema";
import { db } from "@db";

interface PronunciationAnalysis {
  score: number;
  feedback: string[];
  correctPhonemes: string[];
  incorrectPhonemes: string[];
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

      // Call Perplexity AI API for pronunciation analysis
      const response = await fetch("https://api.perplexity.ai/audio/pronunciation", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const analysis = await response.json();

      // Transform the API response into our format
      const result: PronunciationAnalysis = {
        score: analysis.score * 100,
        feedback: this.generateFeedback(analysis),
        correctPhonemes: analysis.phonemes.correct || [],
        incorrectPhonemes: analysis.phonemes.incorrect || []
      };

      return result;
    } catch (error) {
      console.error("Error analyzing pronunciation:", error);
      throw error;
    }
  }

  private static generateFeedback(analysis: any): string[] {
    const feedback: string[] = [];

    // Generate specific feedback based on the analysis
    if (analysis.score < 0.6) {
      feedback.push("Try speaking more slowly and clearly");
    }

    if (analysis.stress_errors?.length > 0) {
      feedback.push("Pay attention to word stress patterns");
    }

    if (analysis.intonation_score < 0.7) {
      feedback.push("Work on your sentence intonation");
    }

    return feedback;
  }

  static async savePronunciationMetrics(
    userId: number,
    exerciseId: number,
    score: number
  ) {
    await db.insert(performanceMetrics).values({
      userId,
      exerciseId,
      accuracy: score,
      responseTime: 0,
      attemptCount: 1,
    });
  }
}
