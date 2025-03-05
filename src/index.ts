import { createSocket } from "dgram";
import { existsSync, readFileSync, writeFileSync } from "fs";
import dnsPacket from "dns-packet";
import type { DNSRecord } from "./types.ts";
import os from "os";

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
  };

  const contents = {
    "dns.test": [
      {
        name: "@",
        type: "A",
        data: getLocalIP(),
      },
    ],
  };

  writeFileSync("db.json", JSON.stringify(contents));
}

const server = createSocket("udp4");

server.on("message", (msg, rinfo) => {
  const db = JSON.parse(readFileSync("db.json", { encoding: "utf-8" }));
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

  const ipFromDb: DNSRecord[] = db[domain];

  if (!ipFromDb) {
    console.error(`Domain "${domain}" not found`);
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
        ttl: record.ttl || 300,
        data: record.data,
      });
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
