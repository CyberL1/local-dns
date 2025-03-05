export interface DNSRecord {
  name: string;
  type: "A";
  ttl: number;
  data: string;
}
