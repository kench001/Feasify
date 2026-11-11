/**
 * Feasify Auto-Grouping Mathematical Feasibility & Distribution Utility
 *
 * For N students, minimum size m, and maximum size M:
 * A valid number of groups G must satisfy:
 *   ceil(N / M) <= G <= floor(N / m)
 * If no valid integer G exists (ceil(N / M) > floor(N / m)), the configuration is impossible.
 */

export interface GroupDistributionResult {
  valid: boolean;
  error?: string;
  groupSizes?: number[];
  numGroups?: number;
}

export function calculateGroupDistribution(
  studentCount: number,
  minMembers: number,
  maxMembers: number
): GroupDistributionResult {
  const N = Math.floor(studentCount);
  const m = Math.floor(minMembers);
  const M = Math.floor(maxMembers);

  if (!Number.isFinite(N) || N <= 0) {
    return {
      valid: false,
      error: "Number of students must be greater than zero.",
    };
  }

  if (!Number.isFinite(m) || !Number.isFinite(M) || m <= 0 || M <= 0) {
    return {
      valid: false,
      error: "Group sizes must be positive integers.",
    };
  }

  if (m > M) {
    return {
      valid: false,
      error: `Minimum group size (${m}) cannot be greater than maximum group size (${M}).`,
    };
  }

  if (N < m) {
    return {
      valid: false,
      error: `Unable to generate groups. The current number of students cannot be divided into groups of ${m} to ${M} members. Please adjust the group size settings.`,
    };
  }

  const minG = Math.ceil(N / M);
  const maxG = Math.floor(N / m);

  if (minG > maxG) {
    return {
      valid: false,
      error: `Unable to generate groups. The current number of students cannot be divided into groups of ${m} to ${M} members. Please adjust the group size settings.`,
    };
  }

  // Prioritize larger group sizes within constraints by choosing G = minG
  const G = minG;
  const baseSize = Math.floor(N / G);
  const remainder = N % G;

  const groupSizes: number[] = [];
  for (let i = 0; i < G; i++) {
    groupSizes.push(baseSize + (i < remainder ? 1 : 0));
  }

  return {
    valid: true,
    numGroups: G,
    groupSizes,
  };
}

// CommonJS compatibility export for test runners
if (typeof module !== "undefined" && module.exports) {
  module.exports = { calculateGroupDistribution };
}
