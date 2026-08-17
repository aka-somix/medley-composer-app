import { createApp } from "./app.js";
import { createContainer } from "./container.js";

const PORT = Number.parseInt(process.env.PORT ?? "4000", 10);
const DB_LOCATION = process.env.DB_LOCATION ?? "./medleys.sqlite";

const container = createContainer({ dbLocation: DB_LOCATION });
const app = createApp(container);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Medleys API listening on http://localhost:${PORT} (db: ${DB_LOCATION})`);
});
