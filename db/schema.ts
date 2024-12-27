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
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
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
  difficulty: decimal("difficulty").notNull().default("1.0"), // Scale from 0.0 to 2.0
  skillType: text("skill_type").notNull(), // vocabulary, grammar, pronunciation, comprehension
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
  responseTime: integer("response_time").notNull(), // in milliseconds
  attemptCount: integer("attempt_count").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const difficultyPreferences = pgTable("difficulty_preferences", {
  userId: integer("user_id")
    .notNull()
    .references(() => users.id)
    .primaryKey(),
  preferredLevel: text("preferred_level").notNull(), // beginner, intermediate, advanced
  adaptiveMode: boolean("adaptive_mode").default(true),
  lastAdjustment: timestamp("last_adjustment").defaultNow(),
  skillLevels: json("skill_levels").$type<{
    vocabulary: number;
    grammar: number;
    pronunciation: number;
    comprehension: number;
  }>().notNull(),
});

export const userRelations = relations(users, ({ many }) => ({
  progress: many(userProgress),
  stats: many(userStats),
  milestones: many(userMilestones),
  challengeAttempts: many(userChallengeAttempts),
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

export const insertUserSchema = createInsertSchema(users, {
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

export const selectUserSchema = createSelectSchema(users);

export type SelectUser = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type User = Omit<SelectUser, "password">;