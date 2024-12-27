import { db } from "@db";
import { lessons, exercises } from "@db/schema";

async function seed() {
  try {
    // Insert mock lessons
    const mockLessons = await db.insert(lessons).values([
      {
        title: "Basic Greetings",
        description: "Learn essential greetings and introductions",
        level: "beginner",
        type: "conversation",
        points: 100,
        duration: 15,
      },
      {
        title: "Numbers 1-20",
        description: "Master counting and basic numbers",
        level: "beginner",
        type: "vocabulary",
        points: 75,
        duration: 10,
      },
      {
        title: "Present Tense Verbs",
        description: "Learn to conjugate common verbs in the present tense",
        level: "intermediate",
        type: "grammar",
        points: 150,
        duration: 20,
      },
      {
        title: "Food and Dining",
        description: "Restaurant vocabulary and ordering phrases",
        level: "beginner",
        type: "vocabulary",
        points: 100,
        duration: 15,
      },
      {
        title: "Past Tense Stories",
        description: "Practice past tense through storytelling",
        level: "advanced",
        type: "grammar",
        points: 200,
        duration: 25,
      },
    ]).returning();

    // Insert exercises for each lesson
    for (const lesson of mockLessons) {
      await db.insert(exercises).values([
        {
          lessonId: lesson.id,
          type: "multiple-choice",
          question: "Select the correct greeting for 'Good morning'",
          options: ["Buenos días", "Buenas noches", "Adiós", "Hasta luego"],
          correctAnswer: "Buenos días",
          difficulty: 1.0,
          skillType: "vocabulary",
          adaptiveFactors: {
            timeWeight: 0.3,
            accuracyWeight: 0.5,
            attemptWeight: 0.2,
          },
        },
        {
          lessonId: lesson.id,
          type: "pronunciation",
          question: "Pronounce the following phrase correctly",
          correctAnswer: "¿Cómo estás?",
          difficulty: 1.2,
          skillType: "pronunciation",
          adaptiveFactors: {
            timeWeight: 0.2,
            accuracyWeight: 0.6,
            attemptWeight: 0.2,
          },
        },
      ]);
    }

    console.log("Seed data inserted successfully!");
  } catch (error) {
    console.error("Error seeding data:", error);
    throw error;
  }
}

seed();
