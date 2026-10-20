import { PrismaClient } from "../generated/client/index.js";
import { createApp } from "./app.js";
import { readConfig } from "./config.js";

const config = readConfig();
const db = new PrismaClient();
const server = createApp(db, config).listen(config.PORT, config.API_BIND_HOST, () => {
  console.info(`DriftGate API listening on http://${config.API_BIND_HOST}:${config.PORT}`);
});
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    server.close(() => {
      void db.$disconnect().then(() => process.exit(0));
    });
  });
}
