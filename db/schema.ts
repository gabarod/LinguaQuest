import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  primaryKey,
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
});

// Define relationships
export const userRelations = relations(users, ({ many }) => ({
  progress: many(userProgress),
  stats: many(userStats),
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

// Schema validation
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