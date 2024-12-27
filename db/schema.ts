import { z } from "zod";
import {
  pgTable,
  text,
  serial,
  boolean,
  timestamp,
  integer,
  jsonb,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

// Supported languages type
export const supportedLanguages = [
  "en",
  "es",
  "fr",
  "de",
  "it"
] as const;

export type SupportedLanguage = typeof supportedLanguages[number];

// Users and Authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  email: text("email").unique(),
  password: text("password").notNull(),
  avatar: text("avatar"),
  isEmailVerified: boolean("is_email_verified").default(false),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Schema validation for users
export const insertUserSchema = createInsertSchema(users, {
  username: z.string().min(3, "Username must be at least 3 characters").max(20, "Username must be less than 20 characters"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
  email: z.string().email("Invalid email address").optional(),
});

export const selectUserSchema = createSelectSchema(users);

// User types
export type SelectUser = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type User = Omit<SelectUser, "password">;

// Buddy system tables
export const buddyConnections = pgTable("buddy_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  buddyId: integer("buddy_id").references(() => users.id).notNull(),
  status: text("status").notNull(), // pending, accepted, rejected
  languageInterest: text("language_interest").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const practiceSessions = pgTable("practice_sessions", {
  id: serial("id").primaryKey(),
  initiatorId: integer("initiator_id").references(() => users.id).notNull(),
  participantId: integer("participant_id").references(() => users.id).notNull(),
  language: text("language").notNull(),
  status: text("status").notNull(), // scheduled, completed, cancelled
  scheduledFor: timestamp("scheduled_for").notNull(),
  duration: integer("duration").notNull(), // in minutes
  topic: text("topic"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const sessionFeedback = pgTable("session_feedback", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => practiceSessions.id).notNull(),
  giverId: integer("giver_id").references(() => users.id).notNull(),
  receiverId: integer("receiver_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(),
  feedback: text("feedback"),
  helpfulness: integer("helpfulness").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Performance tracking and pronunciation specific tables
export const performanceMetrics = pgTable("performance_metrics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(), // pronunciation, grammar, vocabulary, etc.
  score: decimal("score", { precision: 5, scale: 2 }).notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const pronunciationAttempts = pgTable("pronunciation_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  exerciseId: integer("exercise_id").references(() => exercises.id),
  targetText: text("target_text").notNull(),
  language: text("language").notNull(),
  audioUrl: text("audio_url").notNull(),
  transcription: text("transcription"),
  score: decimal("score", { precision: 5, scale: 2 }).notNull(),
  feedback: jsonb("feedback"), // Detailed feedback from AI analysis
  createdAt: timestamp("created_at").defaultNow(),
});

export const difficultyPreferences = pgTable("difficulty_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  skillLevels: jsonb("skill_levels").notNull(), // {vocabulary: 1-5, grammar: 1-5, etc}
  preferredLevel: text("preferred_level").notNull(), // beginner, intermediate, advanced
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Learning content tables
export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(), // vocabulary, grammar, pronunciation, etc.
  level: text("level").notNull(), // beginner, intermediate, advanced
  language: text("language").notNull(),
  points: integer("points").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const exercises = pgTable("exercises", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id").references(() => lessons.id).notNull(),
  type: text("type").notNull(), // multiple-choice, fill-in-blank, pronunciation, etc.
  question: text("question").notNull(),
  correctAnswer: text("correct_answer").notNull(),
  options: jsonb("options"), // for multiple choice questions
  points: integer("points").notNull(),
});

export const userProgress = pgTable("user_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  lessonId: integer("lesson_id").references(() => lessons.id).notNull(),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userStats = pgTable("user_stats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  lessonsCompleted: integer("lessons_completed").default(0),
  totalPoints: integer("total_points").default(0),
  weeklyXP: integer("weekly_xp").default(0),
  monthlyXP: integer("monthly_xp").default(0),
  streak: integer("streak").default(0),
  globalRank: integer("global_rank"),
  lastActivity: timestamp("last_activity").defaultNow(),
});

// Language and localization tables
export const languages = pgTable("languages", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  nativeName: text("native_name").notNull(),
  flag: text("flag"),
  isRightToLeft: boolean("is_right_to_left").default(false),
});

export const userLanguages = pgTable("user_languages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  languageCode: text("language_code").references(() => languages.code).notNull(),
  proficiencyLevel: text("proficiency_level"), // beginner, intermediate, advanced
  isNative: boolean("is_native").default(false),
  isLearning: boolean("is_learning").default(true),
  startedLearningAt: timestamp("started_learning_at").defaultNow(),
  lastPracticed: timestamp("last_practiced").defaultNow(),
});

// Community and social features
export const communityPosts = pgTable("community_posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  language: text("language").notNull(),
  category: text("category").notNull(), // question, discussion, resource, etc.
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const postComments = pgTable("post_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => communityPosts.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const postLikes = pgTable("post_likes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").references(() => communityPosts.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Quiz system
export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  language: text("language").notNull(),
  level: text("level").notNull(),
  type: text("type").notNull(), // proficiency, practice, challenge
  questions: jsonb("questions").notNull(),
  timeLimit: integer("time_limit"), // in minutes
  createdAt: timestamp("created_at").defaultNow(),
});

export const quizAttempts = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").references(() => quizzes.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  score: integer("score").notNull(),
  answers: jsonb("answers").notNull(),
  completedAt: timestamp("completed_at").defaultNow(),
});

// Learning path related tables
export const learningPaths = pgTable("learning_paths", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  currentLevel: text("current_level").notNull(),
  targetLevel: text("target_level").notNull(),
  learningStyle: text("learning_style").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const skillProgression = pgTable("skill_progression", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  pathId: integer("path_id").references(() => learningPaths.id).notNull(),
  skill: text("skill").notNull(), // vocabulary, grammar, pronunciation, etc.
  level: integer("level").notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const aiRecommendations = pgTable("ai_recommendations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  pathId: integer("path_id").references(() => learningPaths.id).notNull(),
  type: text("type").notNull(),
  priority: integer("priority").notNull(),
  reason: text("reason").notNull(),
  metadata: jsonb("metadata").notNull(),
  status: text("status").notNull().default('pending'),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Daily challenges and gamification tables
export const dailyChallenges = pgTable("daily_challenges", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  language: text("language").notNull(),
  points: integer("points").notNull(),
  questions: jsonb("questions").notNull(),
  availableFrom: timestamp("available_from").notNull(),
  availableUntil: timestamp("available_until").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userChallengeAttempts = pgTable("user_challenge_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  challengeId: integer("challenge_id").references(() => dailyChallenges.id).notNull(),
  score: integer("score").notNull(),
  answers: jsonb("answers").notNull(),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const milestones = pgTable("milestones", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(), // achievement, skill, streak
  points: integer("points").notNull(),
  position: integer("position").notNull(),
  requiredLessons: integer("required_lessons").notNull(),
  requiredPoints: integer("required_points").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userMilestones = pgTable("user_milestones", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  milestoneId: integer("milestone_id").references(() => milestones.id).notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow(),
});

// Flashcard system tables
export const flashcards = pgTable("flashcards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  front: text("front").notNull(),
  back: text("back").notNull(),
  imageUrl: text("image_url"),
  translation: text("translation").notNull(),
  language: text("language").notNull(),
  category: text("category").notNull(),
  tags: text("tags").array(),
  multipleChoiceOptions: jsonb("multiple_choice_options").array(),
  wrongAttempts: integer("wrong_attempts").default(0),
  lastReviewed: timestamp("last_reviewed"),
  nextReview: timestamp("next_review"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Update flashcard progress to include more detailed tracking
export const flashcardProgress = pgTable("flashcard_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  flashcardId: integer("flashcard_id").references(() => flashcards.id).notNull(),
  easeFactor: decimal("ease_factor", { precision: 5, scale: 2 }).notNull().default("2.5"),
  interval: integer("interval").notNull().default(1),
  consecutiveCorrect: integer("consecutive_correct").notNull().default(0),
  totalAttempts: integer("total_attempts").notNull().default(0),
  correctAttempts: integer("correct_attempts").notNull().default(0),
  lastReviewedAt: timestamp("last_reviewed_at").defaultNow(),
  nextReviewAt: timestamp("next_review_at").notNull(),
});

export const insertPronunciationAttemptSchema = createInsertSchema(pronunciationAttempts);
export const selectPronunciationAttemptSchema = createSelectSchema(pronunciationAttempts);