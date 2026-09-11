import { printValue } from "../ir/print.js";
import type { BehaviorFunction, CallEffect } from "../types.js";
import { symbolOf, toChangeLocation } from "./helpers.js";
import type { Change } from "./types.js";

interface CallSite {
  callee: string;
  text: string;
}

export function classifyCalls(before: BehaviorFunction, after: BehaviorFunction): Change[] {
  const prev = collectCalls(before);
  const next = collectCalls(after);
  const callees = new Set([...prev.map((site) => site.callee), ...next.map((site) => site.callee)]);
  const changes: Change[] = [];

  for (const callee of callees) {
    const left = prev.filter((site) => site.callee === callee);
    const right = next.filter((site) => site.callee === callee);
    const shared = Math.min(left.length, right.length);

    for (let index = 0; index < shared; index += 1) {
      if (left[index].text !== right[index].text) {
        changes.push({
          kind: "call_arguments_changed",
          symbol: symbolOf(after),
          location: toChangeLocation(after.location),
          before: left[index].text,
          after: right[index].text,
        });
      }
    }

    for (const site of right.slice(shared)) {
      changes.push({
        kind: "call_added",
        symbol: symbolOf(after),
        location: toChangeLocation(after.location),
        after: site.text,
      });
    }

    for (const site of left.slice(shared)) {
      changes.push({
        kind: "call_removed",
        symbol: symbolOf(after),
        location: toChangeLocation(after.location),
        before: site.text,
      });
    }
  }

  return changes;
}

function collectCalls(fn: BehaviorFunction): CallSite[] {
  const sites: CallSite[] = [];
  for (const path of fn.paths) {
    for (const effect of path.effects) {
      if (effect.kind === "call" && !effect.onCatch) {
        sites.push({
          callee: effect.callee,
          text: printCall(effect),
        });
      }
    }
  }
  return sites;
}

function printCall(effect: CallEffect): string {
  const args = (effect.args ?? []).map((arg) => printValue(arg)).join(", ");
  return `${effect.callee}(${args})`;
}
