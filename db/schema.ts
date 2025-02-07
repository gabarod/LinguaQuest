import { z } from "zod";
import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// Supported languages
export const supportedLanguages = [
  'english',
  'spanish',
  'french',
  'german',
  'italian',
  'portuguese',
  'chinese',
  'japanese'
] as const;

export type SupportedLanguage = typeof supportedLanguages[number];

// Base tables first
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  email: text("email").unique(),
  password: text("password").notNull(),
  nativeLanguage: text("native_language").notNull(),
  targetLanguage: text("target_language").notNull().default('english'),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const lessons = pgTable("lessons", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull(),
  level: text("level").notNull(),
  language: text("language").notNull(),
  points: integer("points").notNull(),
  difficulty: integer("difficulty").notNull().default(1),
  duration: integer("duration").notNull().default(30),
  createdAt: timestamp("created_at").defaultNow(),
});

export const exercises = pgTable("exercises", {
  id: serial("id").primaryKey(),
  lessonId: integer("lesson_id").references(() => lessons.id).notNull(),
  type: text("type").notNull(),
  question: text("question").notNull(),
  correctAnswer: text("correct_answer").notNull(),
  points: integer("points").notNull(),
});

// Language progress tracking
export const languageProgress = pgTable("language_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  language: text("language").notNull(),
  lessonId: integer("lesson_id").references(() => lessons.id),
  lessonsCompleted: integer("lessons_completed").default(0),
  totalPoints: integer("total_points").default(0),
  weeklyXP: integer("weekly_xp").default(0),
  monthlyXP: integer("monthly_xp").default(0),
  streak: integer("streak").default(0),
  lastActivity: timestamp("last_activity").defaultNow(),
  completedAt: timestamp("completed_at"),
  proficiencyLevel: text("proficiency_level").default('beginner'),
  globalRank: integer("global_rank").default(999),
}, (table) => ({
  unq: primaryKey({ columns: [table.userId, table.language] }),
}));

// Daily challenges
export const dailyChallenges = pgTable("daily_challenges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  language: text("language").notNull(),
  type: text("type").notNull(),
  description: text("description").notNull(),
  points: integer("points").notNull(),
  completed: boolean("completed").default(false),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const lessonsRelations = relations(lessons, ({ many }) => ({
  exercises: many(exercises),
  languageProgress: many(languageProgress),
}));

export const usersRelations = relations(users, ({ many }) => ({
  languageProgress: many(languageProgress),
  dailyChallenges: many(dailyChallenges),
}));

export const languageProgressRelations = relations(languageProgress, ({ one }) => ({
  user: one(users, {
    fields: [languageProgress.userId],
    references: [users.id],
  }),
  lesson: one(lessons, {
    fields: [languageProgress.lessonId],
    references: [lessons.id],
  }),
}));

// Schemas for validation
export const insertUserSchema = createInsertSchema(users, {
  username: z.string().min(3, "Username must be at least 3 characters").max(20, "Username must be less than 20 characters"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  email: z.string().email("Invalid email address").optional(),
  nativeLanguage: z.enum(supportedLanguages),
  targetLanguage: z.enum(supportedLanguages),
});

export const selectUserSchema = createSelectSchema(users);
export type SelectUser = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Additional types for frontend
export type Lesson = typeof lessons.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type LanguageProgress = typeof languageProgress.$inferSelect;
export type DailyChallenge = typeof dailyChallenges.$inferSelect;