import { createSocket, type RemoteInfo, Socket } from "dgram";
import dnsPacket from "dns-packet";

export const queryTheOtherWorld = (
  server: Socket,
  incomingReq: dnsPacket.DecodedPacket,
  rinfo: RemoteInfo,
) => {
  const externalQuery = dnsPacket.encode({
    type: "query",
    id: incomingReq.id,
    flags: dnsPacket.RECURSION_DESIRED,
    questions: incomingReq.questions,
  });

  const client = createSocket("udp4");

  client.on("message", (response) => {
    server.send(response, rinfo.port, rinfo.address);
    client.close();
  });

  client.send(externalQuery, 53, "8.8.8.8");
};
