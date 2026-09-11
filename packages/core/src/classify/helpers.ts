import type { BehaviorFunction, FunctionSignature, SourceLocation } from "../types.js";
import type { ChangeLocation } from "./types.js";

export function symbolOf(fn: BehaviorFunction): string {
  return fn.identity.container ? `${fn.identity.container}.${fn.name}` : fn.name;
}

export function toChangeLocation(location?: SourceLocation): ChangeLocation | undefined {
  if (!location) {
    return undefined;
  }
  return {
    file: location.file,
    line: location.start.line,
    column: location.start.column,
  };
}

export function printSignature(name: string, signature: FunctionSignature): string {
  const params = signature.parameters
    .map((param) => {
      const rest = param.rest ? "..." : "";
      const optional = param.optional && !param.defaultValue ? "?" : "";
      const type = param.type ? `: ${param.type}` : "";
      const fallback = param.defaultValue ? ` = ${param.defaultValue}` : "";
      return `${rest}${param.name}${optional}${type}${fallback}`;
    })
    .join(", ");
  const ret = signature.returnType ? `: ${signature.returnType}` : "";
  return `${signature.async ? "async " : ""}${name}(${params})${ret}`;
}

