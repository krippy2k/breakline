import type { Finding, ImpactLevel } from "./types.js";

const AUTH_HINT = /auth|authoriz|permission|acl|role|isadmin|allowed|can[a-z]|access control/i;
const VALIDATION_REMOVED = /no longer (reject|validat|require)|validation (removed|dropped)|missing \w+ is no longer/i;

export function classifyImpact(findings: Finding[]): ImpactLevel {
  if (findings.length === 0) {
    return "none";
  }

  const hasHighSevereHighConfidence = findings.some(
    (finding) => finding.severity === "high" && finding.confidence === "high",
  );
  const authorizationChanged = findings.some((finding) => finding.category === "authorization");
  const validationRemoved = findings.some(
    (finding) =>
      finding.category === "validation" &&
      VALIDATION_REMOVED.test(`${finding.title} ${finding.description}`),
  );

  if (hasHighSevereHighConfidence || authorizationChanged || validationRemoved) {
    return "high";
  }

  const mediumFindings = findings.filter((finding) => finding.severity === "medium");
  const meaningfulControlOrError = findings.some(
    (finding) =>
      (finding.category === "error-flow" || finding.category === "control-flow") &&
      finding.confidence !== "low",
  );

  if (mediumFindings.length >= 2 || meaningfulControlOrError) {
    return "medium";
  }

  return "low";
}

export function looksAuthorization(text: string): boolean {
  return AUTH_HINT.test(text);
}
