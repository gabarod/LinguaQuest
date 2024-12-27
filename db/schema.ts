import { z } from "zod";
import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

// Base tables first
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").unique().notNull(),
  email: text("email").unique(),
  password: text("password").notNull(),
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
  duration: integer("duration").notNull().default(30), // duración en minutos
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

// Progress tracking tables
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  progress: many(userProgress),
  stats: many(userStats),
}));

export const lessonsRelations = relations(lessons, ({ many }) => ({
  exercises: many(exercises),
  progress: many(userProgress),
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
});

export const selectUserSchema = createSelectSchema(users);
export type SelectUser = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;