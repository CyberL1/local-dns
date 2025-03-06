import fastify, { type FastifyRequest } from "fastify";
import { readFileSync, writeFileSync } from "fs";
import type { DNSRecord } from "../types.ts";

const app = fastify();

app.get("/", (_req, reply) => {
  reply.type("text/html");
  return readFileSync(`${import.meta.dirname}/views/index.html`);
});

app.get("/edit/:name", (_req, reply) => {
  reply.type("text/html");
  return readFileSync(`${import.meta.dirname}/views/edit.html`);
});

app.get("/api/domains", () => {
  const db = JSON.parse(readFileSync("db.json", { encoding: "utf-8" }));
  return db;
});

app.post(
  "/api/domains",
  (req: FastifyRequest<{ Body: { domainName: string } }>, reply) => {
    const db = JSON.parse(readFileSync("db.json", { encoding: "utf-8" }));
    const domain = req.body.domainName;

    if (db[domain]) {
      reply.code(500);
      return { error: "Domain already exists" };
    }

    db[domain] = [];

    writeFileSync("db.json", JSON.stringify(db), { encoding: "utf-8" });
    return db;
  },
);

app.get(
  "/api/domains/:name",
  (req: FastifyRequest<{ Params: { name: string } }>) => {
    const db = JSON.parse(readFileSync("db.json", { encoding: "utf-8" }));
    const domain = db[req.params.name];

    if (!domain) {
      return { error: "Domain not found" };
    }

    return domain;
  },
);

app.post(
  "/api/domains/:name",
  (
    req: FastifyRequest<{
      Params: { name: string };
      Body: DNSRecord;
    }>,
    reply,
  ) => {
    const db = JSON.parse(readFileSync("db.json", { encoding: "utf-8" }));
    const domain = db[req.params.name];

    if (
      domain.find((r) => r.name === req.body.name && r.type === req.body.type)
    ) {
      reply.code(500);
      return { error: "Record exists already" };
    }

    const record: DNSRecord = {
      name: req.body.name,
      type: req.body.type,
      ttl: req.body.ttl || 300,
      data: req.body.data,
    };

    domain.push(record);

    writeFileSync("db.json", JSON.stringify(db), { encoding: "utf-8" });
    return db;
  },
);

app.delete(
  "/api/domains/:name",
  (req: FastifyRequest<{ Params: { name: string } }>, reply) => {
    const db = JSON.parse(readFileSync("db.json", { encoding: "utf-8" }));

    const domain = req.params.name;

    if (!db[domain]) {
      reply.code(500);
      return { error: "Domain does not exist" };
    }

    delete db[domain];

    writeFileSync("db.json", JSON.stringify(db), { encoding: "utf-8" });
    return db;
  },
);

app.delete(
  "/api/domains/:name/:index",
  (req: FastifyRequest<{ Params: { name: string; index: string } }>, reply) => {
    const db = JSON.parse(readFileSync("db.json", { encoding: "utf-8" }));

    const domain = req.params.name;
    const recordIndex = Number(req.params.index);

    if (!db[domain][recordIndex]) {
      reply.code(500);
      return { error: "Record does not exist" };
    }

    db[domain].splice(recordIndex, 1);

    writeFileSync("db.json", JSON.stringify(db), { encoding: "utf-8" });
    return db;
  },
);

app.listen({ port: 80, host: "0.0.0.0" });
