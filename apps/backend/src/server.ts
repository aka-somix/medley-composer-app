import "dotenv/config";
import { createApp } from "./app.js";
import { createContainer } from "./container.js";

const PORT = Number.parseInt(process.env.PORT ?? "4000", 10);
// Turso remote when TURSO_CONNECTION_URL is set; a local file otherwise.
const DB_LOCATION = process.env.TURSO_CONNECTION_URL ?? "file:medleys.db";
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

const container = await createContainer({
  dbLocation: DB_LOCATION,
  authToken: AUTH_TOKEN,
  googleClientId: GOOGLE_CLIENT_ID,
});
const app = createApp(container);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Tiny Medleys API listening on http://localhost:${PORT} (db: ${DB_LOCATION})`);
});
