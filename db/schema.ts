import { z } from "zod";
import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  primaryKey,
  json,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

export const supportedLanguages = [
  "en",    // English
  "zh",    // Chinese (Mandarin)
  "es",    // Spanish
  "de",    // German
  "fr",    // French
  "it",    // Italian
  "pt",    // Portuguese
] as const;

export type SupportedLanguage = typeof supportedLanguages[number];

export const languages = pgTable("languages", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  nativeName: text("native_name").notNull(),
  flag: text("flag").notNull(),
  isRightToLeft: boolean("is_right_to_left").default(false),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  email: text("email").unique().notNull(),
  password: text("password"),
  googleId: text("google_id").unique(),
  facebookId: text("facebook_id").unique(),
  avatar: text("avatar"),
  isEmailVerified: boolean("is_email_verified").default(false),
  resetPasswordToken: text("reset_password_token").unique(),
  resetPasswordExpires: timestamp("reset_password_expires"),
  rememberMeToken: text("remember_me_token").unique(),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  level: text("level").notNull(),
  type: text("type").notNull(),
  points: integer("points").notNull(),
  duration: integer("duration").notNull(),
});

export const exercises = pgTable("exercises", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id")
    .notNull()
    .references(() => lessons.id),
  type: text("type").notNull(),
  question: text("question").notNull(),
  options: text("options").array(),
  correctAnswer: text("correct_answer").notNull(),
  difficulty: decimal("difficulty").notNull().default("1.0"),
  skillType: text("skill_type").notNull(),
  adaptiveFactors: json("adaptive_factors").$type<{
    timeWeight: number;
    accuracyWeight: number;
    attemptWeight: number;
  }>().notNull(),
});

export const userProgress = pgTable("user_progress", {
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  lessonId: integer("lesson_id")
    .notNull()
    .references(() => lessons.id),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at"),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.lessonId] }),
}));

export const userLanguages = pgTable("user_languages", {
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  languageCode: text("language_code")
    .notNull()
    .references(() => languages.code),
  proficiencyLevel: text("proficiency_level").notNull(),
  isNative: boolean("is_native").default(false),
  isLearning: boolean("is_learning").default(true),
  startedLearningAt: timestamp("started_learning_at").defaultNow(),
  lastPracticed: timestamp("last_practiced"),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.languageCode] }),
}));

export const userStats = pgTable("user_stats", {
  userId: integer("user_id")
    .notNull()
    .references(() => users.id)
    .primaryKey(),
  lessonsCompleted: integer("lessons_completed").default(0),
  totalPoints: integer("total_points").default(0),
  streak: integer("streak").default(0),
  lastActivity: timestamp("last_activity").defaultNow(),
  weeklyXP: integer("weekly_xp").default(0),
  monthlyXP: integer("monthly_xp").default(0),
  globalRank: integer("global_rank"),
  achievements: json("achievements").$type<{
    id: number;
    name: string;
    unlockedAt: string;
  }[]>().default([]),
});

export const milestones = pgTable("milestones", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  type: text("type").notNull(),
  points: integer("points").notNull(),
  position: json("position").notNull().$type<{ x: number; y: number }>(),
  requiredLessons: integer("required_lessons").notNull(),
  requiredPoints: integer("required_points").notNull(),
});

export const userMilestones = pgTable("user_milestones", {
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  milestoneId: integer("milestone_id")
    .notNull()
    .references(() => milestones.id),
  unlockedAt: timestamp("unlocked_at").notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.milestoneId] }),
}));

export const dailyChallenges = pgTable("daily_challenges", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  difficulty: text("difficulty").notNull(),
  points: integer("points").notNull(),
  availableFrom: timestamp("available_from", { withTimezone: true }).notNull(),
  availableUntil: timestamp("available_until", { withTimezone: true }).notNull(),
  questions: json("questions").$type<{
    question: string;
    options: string[];
    correctAnswer: string;
  }[]>().notNull(),
});

export const userChallengeAttempts = pgTable("user_challenge_attempts", {
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  challengeId: integer("challenge_id")
    .notNull()
    .references(() => dailyChallenges.id),
  score: integer("score").default(0),
  completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow(),
  answers: json("answers").$type<{
    questionId: number;
    answer: string;
    correct: boolean;
  }[]>().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.challengeId] }),
}));

export const performanceMetrics = pgTable("performance_metrics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => exercises.id),
  accuracy: decimal("accuracy").notNull(),
  responseTime: integer("response_time").notNull(),
  attemptCount: integer("attempt_count").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const difficultyPreferences = pgTable("difficulty_preferences", {
  userId: integer("user_id")
    .notNull()
    .references(() => users.id)
    .primaryKey(),
  preferredLevel: text("preferred_level", { enum: ["beginner", "intermediate", "advanced"] }).notNull(),
  adaptiveMode: boolean("adaptive_mode").default(true),
  lastAdjustment: timestamp("last_adjustment").defaultNow(),
  skillLevels: json("skill_levels").$type<{
    vocabulary: number;
    grammar: number;
    pronunciation: number;
    comprehension: number;
  }>().notNull(),
});

export const buddyConnections = pgTable("buddy_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  buddyId: integer("buddy_id")
    .notNull()
    .references(() => users.id),
  status: text("status").notNull(),
  languageInterest: text("language_interest").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniquePair: primaryKey({ columns: [table.userId, table.buddyId] }),
}));

export const practiceSessions = pgTable("practice_sessions", {
  id: serial("id").primaryKey(),
  initiatorId: integer("initiator_id")
    .notNull()
    .references(() => users.id),
  participantId: integer("participant_id")
    .notNull()
    .references(() => users.id),
  language: text("language").notNull(),
  status: text("status").notNull(),
  scheduledFor: timestamp("scheduled_for"),
  duration: integer("duration"),
  topic: text("topic"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const sessionFeedback = pgTable("session_feedback", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => practiceSessions.id),
  giverId: integer("giver_id")
    .notNull()
    .references(() => users.id),
  receiverId: integer("receiver_id")
    .notNull()
    .references(() => users.id),
  rating: integer("rating").notNull(),
  feedback: text("feedback"),
  helpfulness: integer("helpfulness").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const flashcards = pgTable("flashcards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  term: text("term").notNull(),
  definition: text("definition").notNull(),
  context: text("context"),
  examples: text("examples").array(),
  difficulty: decimal("difficulty").notNull().default("1.0"),
  lastReviewed: timestamp("last_reviewed"),
  nextReview: timestamp("next_review"),
  proficiency: integer("proficiency").default(0),
  easeFactor: decimal("ease_factor").default("2.5"),
  consecutiveCorrect: integer("consecutive_correct").default(0),
  intervalDays: integer("interval_days").default(1),
  language: text("language").notNull(),
  tags: text("tags").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const flashcardProgress = pgTable("flashcard_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  flashcardId: integer("flashcard_id")
    .notNull()
    .references(() => flashcards.id),
  correct: boolean("correct").notNull(),
  responseTime: integer("response_time"),
  quality: integer("quality").notNull(), // 0-5 rating of how well the answer was remembered
  easeFactor: decimal("ease_factor").notNull(),
  intervalDays: integer("interval_days").notNull(),
  reviewedAt: timestamp("reviewed_at").defaultNow(),
});

export const learningPaths = pgTable("learning_paths", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  language: text("language").notNull(),
  currentLevel: text("current_level").notNull(),
  targetLevel: text("target_level").notNull(),
  weeklyGoal: integer("weekly_goal").notNull(),
  learningStyle: text("learning_style").notNull(),
  interests: text("interests").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const aiRecommendations = pgTable("ai_recommendations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  pathId: integer("path_id")
    .notNull()
    .references(() => learningPaths.id),
  type: text("type").notNull(), // "lesson", "exercise", "practice", etc.
  priority: integer("priority").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("pending"),
  metadata: json("metadata").$type<{
    skillFocus: string[];
    estimatedTime: number;
    difficulty: number;
    prerequisites: number[];
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export const skillProgression = pgTable("skill_progression", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  pathId: integer("path_id")
    .notNull()
    .references(() => learningPaths.id),
  skill: text("skill").notNull(),
  level: decimal("level").notNull(),
  confidence: decimal("confidence").notNull(),
  lastAssessed: timestamp("last_assessed").notNull(),
  history: json("history").$type<{
    date: string;
    level: number;
    activity: string;
  }[]>().default([]),
});

export const pronunciationAttempts = pgTable("pronunciation_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  exerciseId: integer("exercise_id")
    .references(() => exercises.id),
  audioUrl: text("audio_url"),
  targetText: text("target_text").notNull(),
  language: text("language")
    .notNull()
    .references(() => languages.code),
  score: decimal("score").notNull(),
  feedback: json("feedback").$type<{
    overall: number;
    phonemes: {
      phoneme: string;
      score: number;
      feedback: string;
    }[];
    suggestions: string[];
  }>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pronunciationMetrics = pgTable("pronunciation_metrics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  language: text("language")
    .notNull()
    .references(() => languages.code),
  averageScore: decimal("average_score").notNull(),
  totalAttempts: integer("total_attempts").notNull(),
  improvementRate: decimal("improvement_rate"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const communityPosts = pgTable("community_posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  targetLanguage: text("target_language")
    .notNull()
    .references(() => languages.code),
  tags: text("tags").array(),
  likes: integer("likes").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const postComments = pgTable("post_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id")
    .notNull()
    .references(() => communityPosts.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const postLikes = pgTable("post_likes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id")
    .notNull()
    .references(() => communityPosts.id),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueLike: primaryKey({ columns: [table.userId, table.postId] }),
}));

export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  language: text("language")
    .notNull()
    .references(() => languages.code),
  difficulty: text("difficulty").notNull(),
  type: text("type").notNull(), // vocabulary, grammar, comprehension, etc.
  questions: json("questions").$type<{
    id: number;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation: string;
    points: number;
  }[]>().notNull(),
  timeLimit: integer("time_limit"), // in seconds
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const quizAttempts = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  quizId: integer("quiz_id")
    .notNull()
    .references(() => quizzes.id),
  score: integer("score").notNull(),
  maxScore: integer("max_score").notNull(),
  answers: json("answers").$type<{
    questionId: number;
    answer: string;
    correct: boolean;
    timeSpent: number;
  }[]>().notNull(),
  completedAt: timestamp("completed_at").defaultNow(),
});

export const userRelations = relations(users, ({ many }) => ({
  progress: many(userProgress),
  stats: many(userStats),
  milestones: many(userMilestones),
  challengeAttempts: many(userChallengeAttempts),
  flashcards: many(flashcards),
  flashcardProgress: many(flashcardProgress),
  languages: many(userLanguages),
  learningPaths: many(learningPaths),
  recommendations: many(aiRecommendations),
  skillProgression: many(skillProgression),
  pronunciationAttempts: many(pronunciationAttempts),
  pronunciationMetrics: many(pronunciationMetrics),
}));

export const lessonRelations = relations(lessons, ({ many }) => ({
  exercises: many(exercises),
  userProgress: many(userProgress),
}));

export const exerciseRelations = relations(exercises, ({ one }) => ({
  lesson: one(lessons, {
    fields: [exercises.lessonId],
    references: [lessons.id],
  }),
}));

export const userProgressRelations = relations(userProgress, ({ one }) => ({
  user: one(users, {
    fields: [userProgress.userId],
    references: [users.id],
  }),
  lesson: one(lessons, {
    fields: [userProgress.lessonId],
    references: [lessons.id],
  }),
}));

export const userStatsRelations = relations(userStats, ({ one }) => ({
  user: one(users, {
    fields: [userStats.userId],
    references: [users.id],
  }),
}));

export const milestoneRelations = relations(milestones, ({ many }) => ({
  userMilestones: many(userMilestones),
}));

export const userMilestoneRelations = relations(userMilestones, ({ one }) => ({
  user: one(users, {
    fields: [userMilestones.userId],
    references: [users.id],
  }),
  milestone: one(milestones, {
    fields: [userMilestones.milestoneId],
    references: [milestones.id],
  }),
}));

export const dailyChallengeRelations = relations(dailyChallenges, ({ many }) => ({
  attempts: many(userChallengeAttempts),
}));

export const userChallengeAttemptRelations = relations(userChallengeAttempts, ({ one }) => ({
  user: one(users, {
    fields: [userChallengeAttempts.userId],
    references: [users.id],
  }),
  challenge: one(dailyChallenges, {
    fields: [userChallengeAttempts.challengeId],
    references: [dailyChallenges.id],
  }),
}));

export const performanceMetricsRelations = relations(performanceMetrics, ({ one }) => ({
  user: one(users, {
    fields: [performanceMetrics.userId],
    references: [users.id],
  }),
  exercise: one(exercises, {
    fields: [performanceMetrics.exerciseId],
    references: [exercises.id],
  }),
}));

export const difficultyPreferencesRelations = relations(difficultyPreferences, ({ one }) => ({
  user: one(users, {
    fields: [difficultyPreferences.userId],
    references: [users.id],
  }),
}));

export const buddyConnectionsRelations = relations(buddyConnections, ({ one }) => ({
  user: one(users, {
    fields: [buddyConnections.userId],
    references: [users.id],
  }),
  buddy: one(users, {
    fields: [buddyConnections.buddyId],
    references: [users.id],
  }),
}));

export const practiceSessionsRelations = relations(practiceSessions, ({ one, many }) => ({
  initiator: one(users, {
    fields: [practiceSessions.initiatorId],
    references: [users.id],
  }),
  participant: one(users, {
    fields: [practiceSessions.participantId],
    references: [users.id],
  }),
  feedback: many(sessionFeedback),
}));

export const sessionFeedbackRelations = relations(sessionFeedback, ({ one }) => ({
  session: one(practiceSessions, {
    fields: [sessionFeedback.sessionId],
    references: [practiceSessions.id],
  }),
  giver: one(users, {
    fields: [sessionFeedback.giverId],
    references: [users.id],
  }),
  receiver: one(users, {
    fields: [sessionFeedback.receiverId],
    references: [users.id],
  }),
}));

export const flashcardsRelations = relations(flashcards, ({ one, many }) => ({
  user: one(users, {
    fields: [flashcards.userId],
    references: [users.id],
  }),
  progress: many(flashcardProgress),
}));

export const flashcardProgressRelations = relations(flashcardProgress, ({ one }) => ({
  user: one(users, {
    fields: [flashcardProgress.userId],
    references: [users.id],
  }),
  flashcard: one(flashcards, {
    fields: [flashcardProgress.flashcardId],
    references: [flashcards.id],
  }),
}));

export const learningPathRelations = relations(learningPaths, ({ one, many }) => ({
  user: one(users, {
    fields: [learningPaths.userId],
    references: [users.id],
  }),
  recommendations: many(aiRecommendations),
  progression: many(skillProgression),
}));

export const aiRecommendationsRelations = relations(aiRecommendations, ({ one }) => ({
  user: one(users, {
    fields: [aiRecommendations.userId],
    references: [users.id],
  }),
  path: one(learningPaths, {
    fields: [aiRecommendations.pathId],
    references: [learningPaths.id],
  }),
}));

export const skillProgressionRelations = relations(skillProgression, ({ one }) => ({
  user: one(users, {
    fields: [skillProgression.userId],
    references: [users.id],
  }),
  path: one(learningPaths, {
    fields: [skillProgression.pathId],
    references: [learningPaths.id],
  }),
}));

export const pronunciationAttemptsRelations = relations(pronunciationAttempts, ({ one }) => ({
  user: one(users, {
    fields: [pronunciationAttempts.userId],
    references: [users.id],
  }),
  exercise: one(exercises, {
    fields: [pronunciationAttempts.exerciseId],
    references: [exercises.id],
  }),
}));

export const pronunciationMetricsRelations = relations(pronunciationMetrics, ({ one }) => ({
  user: one(users, {
    fields: [pronunciationMetrics.userId],
    references: [users.id],
  }),
}));


export const communityPostRelations = relations(communityPosts, ({ one, many }) => ({
  user: one(users, {
    fields: [communityPosts.userId],
    references: [users.id],
  }),
  comments: many(postComments),
  likes: many(postLikes),
}));

export const postCommentRelations = relations(postComments, ({ one }) => ({
  post: one(communityPosts, {
    fields: [postComments.postId],
    references: [communityPosts.id],
  }),
  user: one(users, {
    fields: [postComments.userId],
    references: [users.id],
  }),
}));

export const postLikeRelations = relations(postLikes, ({ one }) => ({
  post: one(communityPosts, {
    fields: [postLikes.postId],
    references: [communityPosts.id],
  }),
  user: one(users, {
    fields: [postLikes.userId],
    references: [users.id],
  }),
}));

export const quizzesRelations = relations(quizzes, ({ many }) => ({
  attempts: many(quizAttempts),
}));

export const quizAttemptsRelations = relations(quizAttempts, ({ one }) => ({
  user: one(users, {
    fields: [quizAttempts.userId],
    references: [users.id],
  }),
  quiz: one(quizzes, {
    fields: [quizAttempts.quizId],
    references: [quizzes.id],
  }),
}));

export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")
    .optional(), // Optional because social login users won't have a password
});

export const selectUserSchema = createSelectSchema(users);

export type SelectUser = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type User = Omit<SelectUser, "password" | "resetPasswordToken" | "resetPasswordExpires" | "rememberMeToken">;

// Add validation schemas for difficulty preferences
export const difficultyLevels = ["beginner", "intermediate", "advanced"] as const;
export type DifficultyLevel = typeof difficultyLevels[number];

export const insertDifficultyPreferencesSchema = createInsertSchema(difficultyPreferences, {
  preferredLevel: z.enum(difficultyLevels),
  skillLevels: z.object({
    vocabulary: z.number().min(0).max(5),
    grammar: z.number().min(0).max(5),
    pronunciation: z.number().min(0).max(5),
    comprehension: z.number().min(0).max(5),
  }),
});

export type InsertDifficultyPreferences = z.infer<typeof insertDifficultyPreferencesSchema>;
export type SelectDifficultyPreferences = typeof difficultyPreferences.$inferSelect;

export const languageSchema = z.enum(supportedLanguages);

export const insertLearningPathSchema = createInsertSchema(learningPaths);
export const selectLearningPathSchema = createSelectSchema(learningPaths);

export const insertAiRecommendationSchema = createInsertSchema(aiRecommendations);
export const selectAiRecommendationSchema = createSelectSchema(aiRecommendations);

export const insertSkillProgressionSchema = createInsertSchema(skillProgression);
export const selectSkillProgressionSchema = createSelectSchema(skillProgression);

export type InsertLearningPath = typeof learningPaths.$inferInsert;
export type SelectLearningPath = typeof learningPaths.$inferSelect;

export type InsertAiRecommendation = typeof aiRecommendations.$inferInsert;
export type SelectAiRecommendation = typeof aiRecommendations.$inferSelect;

export type InsertSkillProgression = typeof skillProgression.$inferInsert;
export type SelectSkillProgression = typeof skillProgression.$inferSelect;

// Add new schemas and types for flashcard spaced repetition
export const flashcardQualitySchema = z.number().min(0).max(5);

export interface SpacedRepetitionData {
  easeFactor: number;
  intervalDays: number;
  nextReview: Date;
  quality: number;
}

// Update flashcard schemas
export const insertFlashcardSchema = createInsertSchema(flashcards);
export const selectFlashcardSchema = createSelectSchema(flashcards);

export const insertFlashcardProgressSchema = createInsertSchema(flashcardProgress, {
  quality: z.number().min(0).max(5),
});
export const selectFlashcardProgressSchema = createSelectSchema(flashcardProgress);

export type InsertFlashcard = typeof flashcards.$inferInsert;
export type SelectFlashcard = typeof flashcards.$inferSelect;
export type InsertFlashcardProgress = typeof flashcardProgress.$inferInsert;
export type SelectFlashcardProgress = typeof flashcardProgress.$inferSelect;