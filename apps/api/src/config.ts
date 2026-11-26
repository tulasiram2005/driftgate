import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_BIND_HOST: z.enum(["127.0.0.1", "0.0.0.0"]).default("127.0.0.1"),
  PORT: z.coerce.number().int().min(1024).max(65535).default(4100),
  DATABASE_URL: z
    .string()
    .url()
    .refine((s) => /^postgres(ql)?:/.test(s)),
  JWT_SECRET: z.string().min(48),
  JIRA_POLLING_ENABLED: z
    .enum(["0", "1"])
    .default("0")
    .transform((v) => v === "1"),
  INTEGRATION_ENCRYPTION_KEY: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/)
    .optional(),
  THREADLINE_SQL_PROJECT_ID: z.string().min(1).max(100).optional(),
  THREADLINE_READONLY_DATABASE_URL: z
    .string()
    .url()
    .regex(/^postgres(ql)?:/)
    .optional(),
  RUNNER_CALLBACK_SECRET: z.string().min(32).optional(),
  RUNNER_CALLBACK_URL: z.string().url().optional(),
  RUNNER_LOCAL_SANDBOX_ENABLED: z
    .enum(["0", "1"])
    .default("0")
    .transform((v) => v === "1"),
  REDIS_URL: z
    .string()
    .url()
    .regex(/^rediss?:\/\//)
    .optional(),
  GITHUB_TOKEN: z.string().min(1).optional(),
  GITHUB_REPOSITORY: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .optional(),
  RUNNER_GITHUB_WORKFLOW: z
    .string()
    .regex(/^[\w.-]+\.ya?ml$/)
    .default("runner.yml"),
  GITHUB_REF: z.string().min(1).default("main"),
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().min(1).optional(),
  S3_ACCESS_KEY_ID: z.string().min(1).optional(),
  S3_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  RUN_TIMEOUT_MS: z.coerce.number().int().min(60000).max(86400000).default(1800000),
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
