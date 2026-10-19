import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1024).max(65535).default(4100),
  DATABASE_URL: z
    .string()
    .url()
    .refine((s) => /^postgres(ql)?:/.test(s)),
  JWT_SECRET: z.string().min(48),
  API_CORS_ORIGINS: z
    .string()
    .default("http://localhost:3100,http://127.0.0.1:3100")
    .transform((s) => s.split(",").map((v) => v.trim()))
    .pipe(
      z
        .array(
          z
            .string()
            .url()
            .refine((v) => new URL(v).origin === v),
        )
        .min(1),
    ),
});

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  return schema.parse(env);
}
export type Config = ReturnType<typeof readConfig>;
