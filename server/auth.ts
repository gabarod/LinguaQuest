import passport from "passport";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users, insertUserSchema, type SelectUser } from "@db/schema";
import { db } from "@db";
import { eq, or } from "drizzle-orm";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";

const scryptAsync = promisify(scrypt);
const JWT_SECRET = process.env.REPL_ID || "language-learning-secret";

const crypto = {
  hash: async (password: string) => {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
  },
  compare: async (suppliedPassword: string, storedPassword: string) => {
    const [hashedPassword, salt] = storedPassword.split(".");
    const hashedPasswordBuf = Buffer.from(hashedPassword, "hex");
    const suppliedPasswordBuf = (await scryptAsync(
      suppliedPassword,
      salt,
      64
    )) as Buffer;
    return timingSafeEqual(hashedPasswordBuf, suppliedPasswordBuf);
  },
};

declare global {
  namespace Express {
    interface User extends Omit<SelectUser, "password"> {}
  }
}

// Email service setup
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});


export function setupAuth(app: Express) {
  const MemoryStore = createMemoryStore(session);
  const sessionSettings: session.SessionOptions = {
    secret: JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: app.get("env") === "production",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    },
    store: new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    }),
  };

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user) {
          return done(null, false, { message: "Invalid username or password" });
        }

        if (!user.password) {
          return done(null, false, { message: "Please login with social provider" });
        }

        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          return done(null, false, { message: "Invalid username or password" });
        }

        return done(null, user);
      } catch (err) {
        console.error("Login error:", err);
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!user) {
        return done(null, false);
      }

      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        return res
          .status(400)
          .send(result.error.errors.map((e) => e.message).join(", "));
      }

      const { username, email, password } = result.data;
      if (!password) {
        return res.status(400).send("Password is required");
      }

      // Check if username or email already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(or(eq(users.username, username), eq(users.email, email)))
        .limit(1);

      if (existingUser) {
        if (existingUser.username === username) {
          return res.status(400).send("Username already exists");
        }
        return res.status(400).send("Email already exists");
      }

      // Hash password and create user
      const hashedPassword = await crypto.hash(password);
      const [newUser] = await db
        .insert(users)
        .values({
          username,
          email,
          password: hashedPassword,
        })
        .returning();

      // Send verification email
      const verificationToken = jwt.sign(
        { userId: newUser.id },
        JWT_SECRET,
        { expiresIn: "1d" }
      );

      await transporter.sendMail({
        to: email,
        subject: "Verify your email",
        html: `Click <a href="${req.protocol}://${req.get("host")}/api/verify-email?token=${verificationToken}">here</a> to verify your email.`,
      });

      req.login(newUser, (err) => {
        if (err) {
          return next(err);
        }
        return res.json({ message: "Registration successful" });
      });
    } catch (error) {
      console.error("Registration error:", error);
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate(
      "local",
      async (err: Error | null, user: Express.User | false, info: IVerifyOptions) => {
        if (err) {
          console.error("Authentication error:", err);
          return next(err);
        }
        if (!user) {
          return res.status(401).send(info.message || "Authentication failed");
        }


        req.login(user, (err) => {
          if (err) {
            console.error("Login error:", err);
            return next(err);
          }
          return res.json({ message: "Login successful" });
        });
      }
    )(req, res, next);
  });

  // Password reset request
  app.post("/api/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).send("Email is required");
    }

    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return res.status(404).send("User not found");
      }

      const resetToken = jwt.sign(
        { userId: user.id },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      await db
        .update(users)
        .set({
          resetPasswordToken: resetToken,
          resetPasswordExpires: new Date(Date.now() + 3600000), // 1 hour
        })
        .where(eq(users.id, user.id));

      await transporter.sendMail({
        to: email,
        subject: "Password Reset Request",
        html: `Click <a href="${req.protocol}://${req.get("host")}/reset-password?token=${resetToken}">here</a> to reset your password.`,
      });

      res.json({ message: "Password reset email sent" });
    } catch (error) {
      console.error("Password reset request error:", error);
      res.status(500).send("Error sending password reset email");
    }
  });

  // Reset password
  app.post("/api/reset-password", async (req, res) => {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).send("Token and password are required");
    }

    try {
      const [user] = await db
        .select()
        .from(users)
        .where(
          and(
            eq(users.resetPasswordToken, token),
            gte(users.resetPasswordExpires!, new Date())
          )
        )
        .limit(1);

      if (!user) {
        return res.status(400).send("Invalid or expired reset token");
      }

      const hashedPassword = await crypto.hash(password);

      await db
        .update(users)
        .set({
          password: hashedPassword,
          resetPasswordToken: null,
          resetPasswordExpires: null,
        })
        .where(eq(users.id, user.id));

      res.json({ message: "Password has been reset" });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).send("Error resetting password");
    }
  });

  // Email verification
  app.get("/api/verify-email", async (req, res) => {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).send("Invalid verification token");
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };

      await db
        .update(users)
        .set({ isEmailVerified: true })
        .where(eq(users.id, decoded.userId));

      res.redirect("/login?verified=true");
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(400).send("Invalid or expired verification token");
    }
  });

  // Logout
  app.post("/api/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).send("Logout failed");
      }
      res.json({ message: "Logout successful" });
    });
  });

  // Get current user
  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      return res.json(req.user);
    }
    res.status(401).send("Not authenticated");
  });
}