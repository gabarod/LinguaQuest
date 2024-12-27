import { db } from "@db";
import { type User } from "@db/schema";
import { eq } from "drizzle-orm";

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ConversationStarter {
  topic: string;
  prompt: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

export class ChatService {
  private static readonly SUPPORTED_LANGUAGES = ["Spanish", "French", "German", "Italian"];

  static async generateResponse(userId: number, message: string, targetLanguage: string) {
    try {
      // Get user's skill level
      const skillLevel = "beginner"; // Default to beginner for now

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

  static async generateConversationStarters(targetLanguage: string, skillLevel: string): Promise<ConversationStarter[]> {
    try {
      const messages: ChatMessage[] = [
        {
          role: "system",
          content: `You are a language learning expert. Generate 5 conversation starters for ${targetLanguage} 
            language learners at ${skillLevel} level. Each starter should include:
            1. A topic that's engaging and culturally relevant
            2. A natural conversation prompt in both ${targetLanguage} and English
            3. Appropriate for ${skillLevel} level students
            Format as JSON array with fields: topic, prompt, difficulty.`
        },
        {
          role: "user",
          content: "Generate conversation starters"
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
          temperature: 0.8,
          max_tokens: 500,
          frequency_penalty: 1
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return JSON.parse(data.choices[0].message.content);
    } catch (error) {
      console.error("Conversation starters generation error:", error);
      throw new Error("Failed to generate conversation starters");
    }
  }

  static isSupportedLanguage(language: string): boolean {
    return this.SUPPORTED_LANGUAGES.includes(language);
  }

  static async updateUserProgress(userId: number, messageCount: number) {
    // For now, we'll just log the progress
    console.log(`User ${userId} practiced with ${messageCount} messages`);
  }
}