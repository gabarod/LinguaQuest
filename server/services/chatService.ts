import { db } from "@db";
import { type User } from "@db/schema";
import { userStats, difficultyPreferences } from "@db/schema";
import { eq } from "drizzle-orm";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class ChatService {
  private static readonly SUPPORTED_LANGUAGES = ["Spanish", "French", "German", "Italian"];
  
  static async generateResponse(userId: number, message: string, targetLanguage: string) {
    try {
      // Get user's skill level and preferences
      const [preferences] = await db
        .select()
        .from(difficultyPreferences)
        .where(eq(difficultyPreferences.userId, userId));

      const skillLevel = preferences?.preferredLevel || "beginner";
      
      // Create conversation context
      const messages: ChatMessage[] = [
        {
          role: "system",
          content: `You are a helpful language tutor for ${targetLanguage}. 
            Current student level: ${skillLevel}. 
            Respond in both ${targetLanguage} and English. 
            Correct any language mistakes gently and provide explanations.
            Keep responses concise and focused on language learning.`
        },
        {
          role: "user",
          content: message
        }
      ];

      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.PERPLEXITY_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.1-sonar-small-128k-online",
          messages,
          temperature: 0.7,
          max_tokens: 150,
          frequency_penalty: 1
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;

    } catch (error) {
      console.error("Chat generation error:", error);
      throw new Error("Failed to generate chat response");
    }
  }

  static isSupportedLanguage(language: string): boolean {
    return this.SUPPORTED_LANGUAGES.includes(language);
  }

  static async updateUserProgress(userId: number, messageCount: number) {
    // Update user stats to reflect chat practice
    await db
      .update(userStats)
      .set({
        weeklyXP: userStats.weeklyXP + 5,
        monthlyXP: userStats.monthlyXP + 5,
        totalPoints: userStats.totalPoints + 5
      })
      .where(eq(userStats.userId, userId));
  }
}
