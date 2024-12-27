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

        if (!user.password) {
          console.log(`[Auth] Password not set for user: ${username}`);
          return done(null, false, { message: "Por favor inicia sesión con un proveedor social" });
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
        console.log(`[Auth] Failed to deserialize user: ${id}`);
        return done(null, false);
      }

      done(null, user);
    } catch (err) {
      console.error("[Auth] Deserialize error:", err);
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      console.log("[Auth] Registration attempt:", req.body.username);

      const result = insertUserSchema.safeParse(req.body);
      if (!result.success) {
        const errors = result.error.errors.map((e) => e.message).join(", ");
        console.log(`[Auth] Registration validation failed:`, errors);
        return res.status(400).json({ 
          success: false,
          message: "Error de validación",
          errors: errors
        });
      }

      const { username, email, password } = result.data;

      // Check if username or email already exists
      const [existingUser] = await db
        .select()
        .from(users)
        .where(or(eq(users.username, username), eq(users.email, email)))
        .limit(1);

      if (existingUser) {
        const message = existingUser.username === username
          ? "El nombre de usuario ya existe"
          : "El correo electrónico ya está registrado";

        console.log(`[Auth] Registration failed - existing user:`, message);
        return res.status(400).json({
          success: false,
          message: message
        });
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

      console.log(`[Auth] User registered successfully:`, username);

      // Send verification email
      const verificationToken = jwt.sign(
        { userId: newUser.id },
        JWT_SECRET,
        { expiresIn: "1d" }
      );

      await transporter.sendMail({
        to: email,
        subject: "Verifica tu correo electrónico",
        html: `Haz clic <a href="${req.protocol}://${req.get("host")}/api/verify-email?token=${verificationToken}">aquí</a> para verificar tu correo electrónico.`,
      });

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
            email: newUser.email
          }
        });
      });
    } catch (error) {
      console.error("[Auth] Registration error:", error);
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log("[Auth] Login attempt:", req.body.username);

    passport.authenticate(
      "local",
      async (err: Error | null, user: Express.User | false, info: IVerifyOptions) => {
        if (err) {
          console.error("[Auth] Authentication error:", err);
          return next(err);
        }
        if (!user) {
          console.log("[Auth] Authentication failed:", info.message);
          return res.status(401).json({
            success: false,
            message: info.message || "Error de autenticación"
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
              email: user.email
            }
          });
        });
      }
    )(req, res, next);
  });

  // Password reset request
  app.post("/api/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).send("El correo electrónico es obligatorio");
    }

    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (!user) {
        return res.status(404).send("Usuario no encontrado");
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
        subject: "Solicitud de restablecimiento de contraseña",
        html: `Haz clic <a href="${req.protocol}://${req.get("host")}/reset-password?token=${resetToken}">aquí</a> para restablecer tu contraseña.`,
      });

      res.json({ message: "Correo electrónico de restablecimiento de contraseña enviado" });
    } catch (error) {
      console.error("Password reset request error:", error);
      res.status(500).send("Error al enviar el correo electrónico de restablecimiento de contraseña");
    }
  });

  // Reset password
  app.post("/api/reset-password", async (req, res) => {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).send("El token y la contraseña son obligatorios");
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
        return res.status(400).send("Token de restablecimiento inválido o expirado");
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

      res.json({ message: "Contraseña restablecida" });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).send("Error al restablecer la contraseña");
    }
  });

  // Email verification
  app.get("/api/verify-email", async (req, res) => {
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(400).send("Token de verificación inválido");
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
      res.status(400).send("Token de verificación inválido o expirado");
    }
  });

  // Logout
  app.post("/api/logout", (req, res) => {
    const username = req.user?.username;
    console.log("[Auth] Logout attempt:", username);

    req.logout((err) => {
      if (err) {
        console.error("[Auth] Logout error:", err);
        return res.status(500).json({
          success: false,
          message: "Error al cerrar sesión"
        });
      }
      console.log("[Auth] Logout successful:", username);
      res.json({ 
        success: true,
        message: "Sesión cerrada exitosamente" 
      });
    });
  });

  // Get current user
  app.get("/api/user", (req, res) => {
    if (req.isAuthenticated()) {
      const user = req.user as Express.User;
      return res.json({
        success: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email
        }
      });
    }
    res.status(401).json({
      success: false,
      message: "No autenticado"
    });
  });
}