import keys from "./keys.js";
import cors from "cors";
import express from "express";

// Express App Setup
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Postgres Client Setup
import pg from "pg";

const pgClient = new pg.Pool({
  user: keys.pgUser,
  host: keys.pgHost,
  database: keys.pgDatabase,
  password: keys.pgPassword,
  port: keys.pgPort,
});

pgClient.on("error", () => {
  console.log("Lost Postgres connection");
});

pgClient.on("connect", (client) => {
  client
    .query("CREATE TABLE IF NOT EXISTS values (number INT)")
    .catch((err) => console.error(err));
});

// Redis Client Setup
import { createClient } from "redis";

const redisClient = createClient({
  url: `redis://${keys.redisHost}:${keys.redisPort}`,
});

redisClient.on("error", (err) => console.log("Redis Client Error", err));
await redisClient.connect();

const redisPublisher = redisClient.duplicate();
redisPublisher.on("error", (err) => console.error(err));
await redisPublisher.connect();

// Express Route Handlers
app.get("/", (req, res) => {
  res.send("Hi");
});

app.get("/values/all", async (req, res) => {
  const values = await pgClient.query("SELECT * FROM values");
  res.send(values.rows);
});

app.get("/values/current", async (req, res) => {
  const values = await redisClient.hGetAll("values");
  res.send(values);
});

app.post("/values", async (req, res) => {
  const index = req.body.index;

  if (parseInt(index) > 40) {
    return res.status(422).send("Index too high!");
  }

  await redisClient.hSet("values", index, "Nothing yet!");
  await redisPublisher.publish("insert", index);
  await pgClient.query("INSERT INTO values(number) VALUES($1)", [index]);

  res.send({ working: true });
});

app.listen(5000, (err) => {
  console.log("Listening");
});
