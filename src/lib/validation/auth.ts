import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email("Bitte gib eine gültige E-Mail-Adresse ein.");

export const passwordSchema = z
  .string()
  .min(8, "Das Passwort muss mindestens 8 Zeichen lang sein.")
  .regex(/[A-Za-zÄÖÜäöüß]/, "Das Passwort benötigt mindestens einen Buchstaben.")
  .regex(/\d/, "Das Passwort benötigt mindestens eine Zahl.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Bitte gib dein Passwort ein."),
  next: z.string().optional(),
});

export const registrationSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Bitte gib deinen vollständigen Namen ein.")
      .max(100),
    email: emailSchema,
    password: passwordSchema,
    passwordConfirmation: z.string(),
    next: z.string().optional(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Die Passwörter stimmen nicht überein.",
    path: ["passwordConfirmation"],
  });

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Die Passwörter stimmen nicht überein.",
    path: ["passwordConfirmation"],
  });
