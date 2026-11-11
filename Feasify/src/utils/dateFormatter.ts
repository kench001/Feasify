/**
 * Feasify Centralized Date Formatting Utility
 *
 * Formats dates consistently across Student and Adviser modules as well as exported reports.
 * Preferred formats:
 * - Date only: "November 11, 2026"
 * - Date and time: "November 11, 2026, 2:30 PM"
 *
 * Preserves timestamps in storage without modification and uses Asia/Manila (UTC+8) timezone.
 */

const MANILA_TIMEZONE = "Asia/Manila";

export function toEpoch(rawDate: any): number | null {
  if (rawDate === null || rawDate === undefined || rawDate === "") {
    return null;
  }

  // Firestore Timestamp with toMillis() or toDate()
  if (typeof rawDate?.toMillis === "function") {
    const ms = rawDate.toMillis();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof rawDate?.toDate === "function") {
    const d = rawDate.toDate();
    return d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : null;
  }

  // Date instance
  if (rawDate instanceof Date) {
    return Number.isNaN(rawDate.getTime()) ? null : rawDate.getTime();
  }

  // Numbers (unix timestamp ms or sec)
  if (typeof rawDate === "number" && Number.isFinite(rawDate)) {
    // If seconds, convert to ms
    return rawDate < 1e11 ? rawDate * 1000 : rawDate;
  }

  // String handling
  if (typeof rawDate === "string") {
    const trimmed = rawDate.trim();
    if (!trimmed) return null;

    // Check for strict YYYY-MM-DD date-only pattern
    const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (dateOnlyMatch) {
      const year = parseInt(dateOnlyMatch[1], 10);
      const month = parseInt(dateOnlyMatch[2], 10) - 1;
      const day = parseInt(dateOnlyMatch[3], 10);
      // Treat as Manila local midnight (UTC+8)
      const utcMs = Date.UTC(year, month, day, 0, 0, 0) - 8 * 3600 * 1000;
      return utcMs;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  return null;
}

/**
 * Format date to readable string: "November 11, 2026"
 */
export function formatDisplayDate(rawDate: any, fallback = "N/A"): string {
  // Check if string matches YYYY-MM-DD exactly to prevent any edge-case timezone shift
  if (typeof rawDate === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate.trim());
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      if (month >= 0 && month < 12 && day >= 1 && day <= 31) {
        return `${months[month]} ${day}, ${year}`;
      }
    }
  }

  const epoch = toEpoch(rawDate);
  if (epoch === null) return fallback;

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: MANILA_TIMEZONE,
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    return formatter.format(new Date(epoch));
  } catch (e) {
    const d = new Date(epoch);
    return `${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
  }
}

/**
 * Format date and time to: "November 11, 2026, 2:30 PM"
 */
export function formatDisplayDateTime(rawDate: any, fallback = "N/A"): string {
  const epoch = toEpoch(rawDate);
  if (epoch === null) return fallback;

  try {
    const d = new Date(epoch);
    const dateFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: MANILA_TIMEZONE,
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const timeFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: MANILA_TIMEZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${dateFormatter.format(d)}, ${timeFormatter.format(d)}`;
  } catch (e) {
    const d = new Date(epoch);
    return d.toLocaleString("en-US");
  }
}

/**
 * Formats proposal submission or creation date consistently
 */
export function formatProposalDate(proposal: any, includeTime = false): string {
  if (!proposal) return "N/A";

  const dateValue = proposal.submissionDate || proposal.submittedAt || proposal.createdAt;
  if (!dateValue) {
    if (proposal.status === "Draft") {
      return "Draft (Not submitted)";
    }
    return "Submitted recently";
  }

  const formatted = includeTime ? formatDisplayDateTime(dateValue, "") : formatDisplayDate(dateValue, "");
  if (!formatted || formatted === "N/A") {
    if (proposal.status === "Draft") return "Draft (Not submitted)";
    return "Submitted recently";
  }

  return formatted;
}

// CommonJS compatibility export for test runners
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    toEpoch,
    formatDisplayDate,
    formatDisplayDateTime,
    formatProposalDate,
  };
}
