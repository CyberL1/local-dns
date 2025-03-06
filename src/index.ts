// Run the bundled DNS Admin Panel
import "./dnsAdmin/index.ts";

import { createSocket } from "dgram";
import { existsSync, readFileSync, writeFileSync } from "fs";
import dnsPacket from "dns-packet";
import type { DB, DNSRecord } from "./types.ts";
import os from "os";
import { queryTheOtherWorld } from "./utils.ts";

if (!existsSync("db.json")) {
  console.log("DB does not exist, creating");

  const getLocalIP = () => {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          return iface.address;
        }
      }
    }

    return "127.0.0.1";
  };

  const contents: DB = {
    settings: { queryTheOuterWorld: false },
    records: {
      "dns.test": [
        {
          name: "@",
          type: "A",
          ttl: 300,
          data: getLocalIP(),
        },
      ],
    },
  };

  writeFileSync("db.json", JSON.stringify(contents));
}

const server = createSocket("udp4");

server.on("message", (msg, rinfo) => {
  const dbContents = readFileSync("db.json", { encoding: "utf-8" });
  const db: DB = JSON.parse(dbContents);

  const incomingReq = dnsPacket.decode(msg);

  if (!incomingReq.questions) {
    return;
  }

  let domain = incomingReq.questions[0].name;
  const type = incomingReq.questions[0].type;

  let subdomain = "";

  if (domain.split(".").length > 2) {
    subdomain = domain.split(".").slice(0, -2).join(".");
    domain = domain.split(".").slice(-2).join(".");
  }

  const ipFromDb: DNSRecord[] = db.records[domain];

  if (!ipFromDb) {
    console.warn(`[DOMAIN:${domain}] Not in DB`);

    if (db.settings.queryTheOuterWorld) {
      console.log(`[DOMAIN:${domain}] Querying the outer world`);
      queryTheOtherWorld(server, incomingReq, rinfo);
    }

    return;
  }

  const answers: dnsPacket.Answer[] = [];
  const records: DNSRecord[] = ipFromDb.filter(
    (r) => r.name === (subdomain || "@"),
  );

  records.map((record) => {
    const name = subdomain ? `${subdomain}.${domain}` : domain;

    if (record.type === type) {
      answers.push({
        name,
        type: record.type,
        class: "IN",
        ttl: record.ttl,
        data: record.data,
      });
    } else if (record.type === "CNAME") {
      const visited = new Set();

      while (record.data) {
        if (visited.has(record.data)) {
          console.warn(`[CNAME LOOP DETECTED] ${record.data}`);
          return;
        }
        visited.add(record.data);

        answers.push({
          name,
          type: "CNAME",
          class: "IN",
          ttl: record.ttl,
          data: record.data,
        });

        if (!db.records[record.data]) {
          console.warn(`[DOMAIN:${record.data}] Not in DB`);

          if (db.settings.queryTheOuterWorld) {
            console.warn(
              `[DOMAIN:${record.data}] Querying the outer world for CNAME not implemented`,
            );
          }
          return;
        }

        const recordIndex = db.records[record.data].findIndex(
          (r) =>
            r.name ===
            (domain.split(".").length > 2
              ? domain.split(".").slice(0, -2).join(".")
              : "@"),
        );

        const targetRecord = db.records[record.data][recordIndex];

        if (!targetRecord) {
          return;
        }

        if (targetRecord.type === "CNAME") {
          record.data = targetRecord.data;
        } else {
          answers.push({
            name: targetRecord.name === "@" ? record.data : targetRecord.name,
            type: targetRecord.type,
            class: "IN",
            ttl: targetRecord.ttl,
            data: targetRecord.data,
          });
          return;
        }
      }
    }
  });

  const ans = dnsPacket.encode({
    type: "response",
    id: incomingReq.id,
    flags: dnsPacket.AUTHORITATIVE_ANSWER,
    questions: incomingReq.questions,
    answers,
  });

  server.send(ans, rinfo.port, rinfo.address);
});

server.on("error", (err) => {
  console.error(`Server error:\n${err.stack}`);
  server.close();
});

server.bind(53, () => console.log("DNS Server is running on port 53"));
