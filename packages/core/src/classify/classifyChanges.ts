import { classifyCalls } from "./callClassifier.js";
import { classifyConditions } from "./conditionClassifier.js";
import { classifyExceptions } from "./exceptionClassifier.js";
import { classifyPresence } from "./presenceClassifier.js";
import { classifyReturns } from "./returnClassifier.js";
import { classifySignature } from "./signatureClassifier.js";
import type { Change, ChangeClassifier, ClassifyInput } from "./types.js";

const classifiers: ChangeClassifier[] = [
  { classify: classifyPresence },
  {
    classify: (input) =>
      input.pairs.flatMap(({ before, after }) => [
        ...classifySignature(before, after),
        ...classifyConditions(before, after),
        ...classifyReturns(before, after),
        ...classifyCalls(before, after),
        ...classifyExceptions(before, after),
      ]),
  },
];

export function classifyChanges(input: ClassifyInput): Change[] {
  return classifiers.flatMap((classifier) => classifier.classify(input));
}
