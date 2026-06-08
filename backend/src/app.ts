import cors from "cors";
import express from "express";
import { env } from "./config/env";
import routes from "./routes";

const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    }
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ message: `${env.appName} API` });
});

app.use(env.apiBasePath, routes);

export default app;
