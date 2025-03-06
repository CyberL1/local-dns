export interface DB {
  settings: DBSettings;
  records: { [key: string]: DNSRecord[] };
}

export interface DBSettings {
  queryTheOuterWorld: boolean;
}

export interface DNSRecord {
  name: string;
  type: "A" | "CNAME";
  ttl: number;
  data: string;
}
