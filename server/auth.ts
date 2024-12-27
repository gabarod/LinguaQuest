import passport from "passport";
import { IVerifyOptions, Strategy as LocalStrategy } from "passport-local";
import { type Express } from "express";
import session from "express-session";
import createMemoryStore from "memorystore";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { users, insertUserSchema, type SelectUser } from "@db/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";

const scryptAsync = promisify(scrypt);

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

export function setupAuth(app: Express) {
  const MemoryStore = createMemoryStore(session);
  const sessionSettings: session.SessionOptions = {
    secret: process.env.REPL_ID || "language-learning-secret",
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
        console.log(`[Auth] Login attempt for username: ${username}`);

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.username, username))
          .limit(1);

        if (!user) {
          console.log(`[Auth] User not found: ${username}`);
          return done(null, false, { message: "Usuario o contraseña incorrectos" });
        }

        const isMatch = await crypto.compare(password, user.password);
        if (!isMatch) {
          console.log(`[Auth] Invalid password for user: ${username}`);
          return done(null, false, { message: "Usuario o contraseña incorrectos" });
        }

        console.log(`[Auth] Successful login for user: ${username}`);
        return done(null, user);
      } catch (err) {
        console.error("[Auth] Login error:", err);
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
      console.log("[Auth] Registration attempt:", req.body);

      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        const errors = result.error.errors.map((e) => e.message).join(", ");
        console.log(`[Auth] Registration validation failed:`, errors);
        return res.status(400).json({
          success: false,
          message: errors,
        });
      }

      const { username, password } = result.data;

      // Check if username already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (existingUser) {
        console.log(`[Auth] Registration failed - username exists:`, username);
        return res.status(400).json({
          success: false,
          message: "El nombre de usuario ya existe",
        });
      }

      const hashedPassword = await crypto.hash(password);
      const [newUser] = await db
        .insert(users)
        .values({
          username,
          password: hashedPassword,
        })
        .returning();

      console.log(`[Auth] User registered successfully:`, username);

      req.login(newUser, (err) => {
        if (err) {
          console.error("[Auth] Post-registration login error:", err);
          return next(err);
        }
        return res.json({
          success: true,
          message: "Registro exitoso",
          user: {
            id: newUser.id,
            username: newUser.username,
          },
        });
      });
    } catch (error) {
      console.error("[Auth] Registration error:", error);
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate(
      "local",
      (err: Error | null, user: Express.User | false, info: IVerifyOptions) => {
        if (err) {
          console.error("[Auth] Authentication error:", err);
          return next(err);
        }
        if (!user) {
          console.log("[Auth] Authentication failed:", info.message);
          return res.status(401).json({
            success: false,
            message: info.message || "Error de autenticación",
          });
        }

        req.login(user, (err) => {
          if (err) {
            console.error("[Auth] Login error:", err);
            return next(err);
          }
          console.log("[Auth] Login successful:", user.username);
          return res.json({
            success: true,
            message: "Inicio de sesión exitoso",
            user: {
              id: user.id,
              username: user.username,
            },
          });
        });
      }
    )(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    const username = req.user?.username;
    console.log("[Auth] Logout attempt:", username);

    req.logout((err) => {
      if (err) {
        console.error("[Auth] Logout error:", err);
        return res.status(500).json({
          success: false,
          message: "Error al cerrar sesión",
        });
      }
      console.log("[Auth] Logout successful:", username);
      res.json({
        success: true,
        message: "Sesión cerrada exitosamente",
      });
    });
  });

  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      const user = req.user as Express.User;
      return res.json({
        id: user.id,
        username: user.username,
      });
    }
    res.status(401).json({
      success: false,
      message: "No autenticado",
    });
  });
}