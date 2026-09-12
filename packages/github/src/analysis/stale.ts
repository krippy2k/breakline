export function isStaleHead(analysisHeadSha: string, currentHeadSha: string | undefined): boolean {
  if (!currentHeadSha) {
    return false;
  }
  return analysisHeadSha !== currentHeadSha;
}

export function sameAnalysisIdentity(left: { baseSha: string; headSha: string }, right: {
  baseSha: string;
  headSha: string;
}): boolean {
  return left.baseSha === right.baseSha && left.headSha === right.headSha;
}
