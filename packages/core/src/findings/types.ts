import type { ChangeKind, ChangeLocation } from "../classify/types.js";

export type FindingSeverity = "info" | "warning";

export interface Finding {
  id: string;
  kind: ChangeKind;
  symbol: string;
  summary: string;
  detail?: string;
  before?: string;
  after?: string;
  location?: ChangeLocation;
  severity: FindingSeverity;
}
