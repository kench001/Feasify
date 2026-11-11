import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  classifyProposalFeasibility,
  resolveProposalBusinessName,
  resolveProposalDisplayStatus,
  selectActiveProposalForGroup,
  toEpochMs,
  type FeasibilityVerdictStatus,
  type ProposalDisplayStatusLabel,
} from "../utils/aiAnalysisHelpers";

export interface ChairpersonRosterMember {
  id: string;
  name: string;
  studentId: string;
  role: "Leader" | "Member";
}

export interface ChairpersonProposalItem {
  id: string;
  groupId: string;
  proposalNumber: number;
  businessName: string;
  companyName: string;
  businessLogo: string;
  companyLogo: string;
  businessType: string;
  groupNumber: number;
  section: string;
  leaderName: string;
  advisers: string[];
  adviserName: string;
  status: ProposalDisplayStatusLabel;
  rawStatus: string;
  aiStatus: FeasibilityVerdictStatus;
  aiScore: number | null;
  aiSentiment: "positive" | "negative" | "pending";
  isConditionalFeasible: boolean;
  aiSource: "financial-audit" | "stored-ai" | "pending";
  category: string;
  memberCount: number;
  rosterMembers: ChairpersonRosterMember[];
  proposalData: RawFirestoreRecord;
  groupData: RawFirestoreRecord;
  createdAtMs: number;
  date: string;
}

export interface RawFirestoreRecord {
  id: string;
  [key: string]: any;
}

export interface BuildChairpersonProposalItemsInput {
  proposals: RawFirestoreRecord[];
  groups: RawFirestoreRecord[];
  users: RawFirestoreRecord[];
}

export interface ChairpersonHeaderState {
  userName: string;
  unreadCount: number;
}

const pickNonEmptyString = (...values: unknown[]): string => {
  for (const val of values) {
    if (typeof val === "string" && val.trim() !== "") {
      return val.trim();
    }
  }
  return "";
};

const formatUserDisplayName = (
  user: RawFirestoreRecord | undefined,
  fallback: string
): string => {
  if (!user) return fallback;
  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  if (fullName) return fullName;
  if (typeof user.email === "string" && user.email.trim() !== "") {
    return user.email.trim();
  }
  return fallback;
};

const parseUserSections = (sectionValue: unknown): string[] => {
  if (typeof sectionValue === "string") {
    return sectionValue
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(sectionValue)) {
    return sectionValue
      .map((s) => (typeof s === "string" ? s.trim() : ""))
      .filter(Boolean);
  }
  return [];
};

const resolveGroupSection = (
  group: RawFirestoreRecord,
  leaderUser: RawFirestoreRecord | undefined
): string => {
  const rawGroupSection =
    typeof group.section === "string" ? group.section.trim() : "";
  if (rawGroupSection && rawGroupSection.toUpperCase() !== "ALL") {
    return rawGroupSection;
  }

  const rawLeaderSection =
    typeof leaderUser?.section === "string" ? leaderUser.section.trim() : "";
  if (rawLeaderSection && rawLeaderSection.toUpperCase() !== "ALL") {
    return rawLeaderSection;
  }

  return "Unknown Section";
};

const computeMemberCount = (group: RawFirestoreRecord): number => {
  if (!Array.isArray(group.memberIds)) return 1;
  const leaderId = typeof group.leaderId === "string" ? group.leaderId.trim() : "";
  const uniqueMembers = new Set<string>();
  for (const rawId of group.memberIds) {
    if (typeof rawId === "string") {
      const trimmed = rawId.trim();
      if (trimmed && trimmed !== leaderId) {
        uniqueMembers.add(trimmed);
      }
    }
  }
  return uniqueMembers.size + 1;
};

const buildGroupRosterMembers = (
  group: RawFirestoreRecord,
  usersById: Record<string, RawFirestoreRecord>
): ChairpersonRosterMember[] => {
  const roster: ChairpersonRosterMember[] = [];
  const leaderId = typeof group.leaderId === "string" ? group.leaderId.trim() : "";
  const rawLeaderName =
    typeof group.leaderName === "string" ? group.leaderName.trim() : "";

  if (leaderId || rawLeaderName) {
    const leaderUser = leaderId ? usersById[leaderId] : undefined;
    const leaderUserFullName = leaderUser
      ? `${leaderUser.firstName || ""} ${leaderUser.lastName || ""}`.trim()
      : "";
    const resolvedLeaderName =
      leaderUserFullName || rawLeaderName || "Unknown Leader";
    const leaderStudentId =
      (typeof leaderUser?.studentId === "string" &&
        leaderUser.studentId.trim()) ||
      "ID Unknown";

    roster.push({
      id: leaderId || `leader-${group.id}`,
      name: resolvedLeaderName,
      studentId: leaderStudentId,
      role: "Leader",
    });
  }

  const seenIds = new Set<string>();
  if (leaderId) seenIds.add(leaderId);

  const memberIds = Array.isArray(group.memberIds) ? group.memberIds : [];
  for (const rawMemberId of memberIds) {
    if (typeof rawMemberId !== "string") continue;
    const memberId = rawMemberId.trim();
    if (!memberId || seenIds.has(memberId)) continue;
    seenIds.add(memberId);

    const student = usersById[memberId];
    if (!student) continue;

    const studentFullName =
      `${student.firstName || ""} ${student.lastName || ""}`.trim() ||
      (typeof student.email === "string" ? student.email.trim() : "") ||
      "Member";
    const studentId =
      typeof student.studentId === "string" ? student.studentId.trim() : "";

    roster.push({
      id: memberId,
      name: studentFullName,
      studentId,
      role: "Member",
    });
  }

  return roster;
};

const resolveProposalCreatedAtMs = (proposal: RawFirestoreRecord): number =>
  toEpochMs(proposal.createdAt) ||
  toEpochMs(proposal.submissionDate) ||
  toEpochMs(proposal.updatedAt);

const assignProposalSlotNumbers = (
  validProposals: Array<{
    proposal: RawFirestoreRecord;
    groupId: string;
    createdAtMs: number;
  }>
): Record<string, number> => {
  const byGroup: Record<
    string,
    Array<{ id: string; explicitSlot: number | null; createdAtMs: number; order: number }>
  > = {};

  validProposals.forEach(({ proposal, groupId, createdAtMs }, idx) => {
    const rawNum = Number(proposal.proposalNumber);
    const explicitSlot =
      Number.isFinite(rawNum) && rawNum > 0 ? Math.floor(rawNum) : null;
    if (!byGroup[groupId]) byGroup[groupId] = [];
    byGroup[groupId].push({
      id: proposal.id,
      explicitSlot,
      createdAtMs,
      order: idx,
    });
  });

  const slotById: Record<string, number> = {};

  Object.values(byGroup).forEach((entries) => {
    const usedSlots = new Set<number>();
    entries.forEach((entry) => {
      if (entry.explicitSlot !== null) {
        usedSlots.add(entry.explicitSlot);
        slotById[entry.id] = entry.explicitSlot;
      }
    });

    const missingEntries = entries
      .filter((entry) => entry.explicitSlot === null)
      .sort((a, b) => {
        if (a.createdAtMs !== b.createdAtMs) {
          if (a.createdAtMs === 0) return 1;
          if (b.createdAtMs === 0) return -1;
          return a.createdAtMs - b.createdAtMs;
        }
        return a.order - b.order;
      });

    let nextSlot = 1;
    missingEntries.forEach((entry) => {
      while (usedSlots.has(nextSlot)) {
        nextSlot += 1;
      }
      usedSlots.add(nextSlot);
      slotById[entry.id] = nextSlot;
      nextSlot += 1;
    });
  });

  return slotById;
};

/**
 * Pure join & aggregation builder transforming raw `proposals`, `groups`, and `users`
 * collections into normalized per-proposal items for Chairperson Business Feasibility Management.
 */
export const buildChairpersonProposalItems = ({
  proposals,
  groups,
  users,
}: BuildChairpersonProposalItemsInput): ChairpersonProposalItem[] => {
  const groupsById: Record<string, RawFirestoreRecord> = {};
  groups.forEach((g) => {
    if (g && typeof g.id === "string" && g.id) {
      groupsById[g.id] = g;
    }
  });

  const groupNumberById: Record<string, number> = {};
  Object.values(groupsById)
    .sort((a, b) => {
      const timeDiff = toEpochMs(a.createdAt) - toEpochMs(b.createdAt);
      if (timeDiff !== 0) return timeDiff;
      return a.id.localeCompare(b.id);
    })
    .forEach((g, idx) => {
      groupNumberById[g.id] = idx + 1;
    });

  const usersById: Record<string, RawFirestoreRecord> = {};
  const advisersBySection: Record<string, string[]> = {};
  const advisersBySectionLower: Record<string, string[]> = {};
  const adviserByUid: Record<string, string> = {};

  users.forEach((u) => {
    if (!u || typeof u.id !== "string" || !u.id) return;
    usersById[u.id] = u;

    if (u.role === "Adviser") {
      const adviserName = formatUserDisplayName(u, "Adviser");
      adviserByUid[u.id] = adviserName;

      const sections = parseUserSections(u.section);
      sections.forEach((sec) => {
        if (!advisersBySection[sec]) {
          advisersBySection[sec] = [];
        }
        if (!advisersBySection[sec].includes(adviserName)) {
          advisersBySection[sec].push(adviserName);
        }

        const lowerKey = sec.toLowerCase();
        if (!advisersBySectionLower[lowerKey]) {
          advisersBySectionLower[lowerKey] = [];
        }
        if (!advisersBySectionLower[lowerKey].includes(adviserName)) {
          advisersBySectionLower[lowerKey].push(adviserName);
        }
      });
    }
  });

  const validEntries: Array<{
    proposal: RawFirestoreRecord;
    group: RawFirestoreRecord;
    groupId: string;
    createdAtMs: number;
  }> = [];

  proposals.forEach((proposal) => {
    if (!proposal || typeof proposal.id !== "string" || !proposal.id) return;
    const groupId =
      typeof proposal.groupId === "string" ? proposal.groupId.trim() : "";
    if (!groupId) return;

    const group = groupsById[groupId];
    if (!group) return; // Skip orphaned proposals whose group was deleted

    validEntries.push({
      proposal,
      group,
      groupId,
      createdAtMs: resolveProposalCreatedAtMs(proposal),
    });
  });

  const slotByProposalId = assignProposalSlotNumbers(validEntries);

  const proposalsByGroupId: Record<string, RawFirestoreRecord[]> = {};
  validEntries.forEach(({ proposal, groupId }) => {
    if (!proposalsByGroupId[groupId]) {
      proposalsByGroupId[groupId] = [];
    }
    proposalsByGroupId[groupId].push(proposal);
  });

  const resolvedActiveIdByGroup: Record<string, string | undefined> = {};
  Object.entries(proposalsByGroupId).forEach(([groupId, groupProposals]) => {
    groupProposals.sort(
      (a, b) => (slotByProposalId[a.id] || 1) - (slotByProposalId[b.id] || 1)
    );
    const activeProposal = selectActiveProposalForGroup(
      groupsById[groupId],
      groupProposals
    );
    resolvedActiveIdByGroup[groupId] =
      typeof activeProposal?.id === "string" ? activeProposal.id : undefined;
  });

  const items: ChairpersonProposalItem[] = validEntries.map(
    ({ proposal, group, groupId, createdAtMs }) => {
      const proposalNumber = slotByProposalId[proposal.id] || 1;
      const proposalWithSlot =
        proposal.proposalNumber === proposalNumber
          ? proposal
          : { ...proposal, proposalNumber };

      const leaderId =
        typeof group.leaderId === "string" ? group.leaderId.trim() : "";
      const leaderUser = leaderId ? usersById[leaderId] : undefined;
      const section = resolveGroupSection(group, leaderUser);
      const leaderName =
        pickNonEmptyString(group.leaderName) ||
        formatUserDisplayName(leaderUser, "Unknown Leader");

      const sectionAdvisers =
        section !== "Unknown Section"
          ? advisersBySection[section] ||
            advisersBySectionLower[section.toLowerCase()] ||
            []
          : [];

      const advisers = [...sectionAdvisers];
      if (advisers.length === 0 && typeof proposal.facultyId === "string") {
        const facultyId = proposal.facultyId.trim();
        if (facultyId && adviserByUid[facultyId]) {
          advisers.push(adviserByUid[facultyId]);
        }
      }

      const adviserName =
        advisers.length > 0 ? advisers.join(", ") : "Unassigned";

      const { businessName, companyName } = resolveProposalBusinessName(
        proposalWithSlot,
        group
      );
      const { label: status, rawStatus } = resolveProposalDisplayStatus(
        proposalWithSlot,
        group,
        resolvedActiveIdByGroup[groupId]
      );
      const feasibility = classifyProposalFeasibility(proposalWithSlot);

      const category =
        pickNonEmptyString(
          proposal.businessType,
          group.category,
          section !== "Unknown Section" ? section : ""
        ) || "General";

      const date =
        createdAtMs > 0 ? new Date(createdAtMs).toLocaleDateString() : "N/A";

      const businessLogo =
        (typeof proposal.businessLogo === "string" &&
          proposal.businessLogo.trim()) ||
        (typeof group.businessLogo === "string" && group.businessLogo.trim()) ||
        "";
      const companyLogo =
        (typeof group.companyLogo === "string" && group.companyLogo.trim()) ||
        "";
      const businessType =
        (typeof proposal.businessType === "string" &&
          proposal.businessType.trim()) ||
        "Uncategorized";
      const groupNumber = groupNumberById[groupId] || 1;
      const rosterMembers = buildGroupRosterMembers(group, usersById);
      const proposalData: RawFirestoreRecord = { ...proposal, id: proposal.id };
      const groupData: RawFirestoreRecord = { ...group, id: group.id };

      return {
        id: proposal.id,
        groupId,
        proposalNumber,
        businessName,
        companyName,
        businessLogo,
        companyLogo,
        businessType,
        groupNumber,
        section,
        leaderName,
        advisers,
        adviserName,
        status,
        rawStatus,
        aiStatus: feasibility.aiStatus,
        aiScore: feasibility.aiScore,
        aiSentiment: feasibility.sentiment,
        isConditionalFeasible: feasibility.isConditional,
        aiSource: feasibility.source,
        category,
        memberCount: computeMemberCount(group),
        rosterMembers,
        proposalData,
        groupData,
        createdAtMs,
        date,
      };
    }
  );

  items.sort((a, b) => {
    if (b.createdAtMs !== a.createdAtMs) {
      return b.createdAtMs - a.createdAtMs;
    }
    if (a.proposalNumber !== b.proposalNumber) {
      return a.proposalNumber - b.proposalNumber;
    }
    const nameCmp = a.businessName.localeCompare(b.businessName, undefined, {
      sensitivity: "base",
    });
    if (nameCmp !== 0) return nameCmp;
    return a.id.localeCompare(b.id);
  });

  return items;
};

/**
 * Subscribes in real time to `groups`, `proposals`, and `users` in parallel,
 * joining and aggregating per-proposal feasibility records without nested listener churn.
 */
export const subscribeChairpersonFeasibilityData = (
  onData: (items: ChairpersonProposalItem[]) => void,
  onError?: (err: unknown) => void
): (() => void) => {
  let latestGroups: RawFirestoreRecord[] = [];
  let latestProposals: RawFirestoreRecord[] = [];
  let latestUsers: RawFirestoreRecord[] = [];

  let hasGroups = false;
  let hasProposals = false;
  let hasUsers = false;
  let isUnsubscribed = false;

  const emitIfReady = () => {
    if (isUnsubscribed || !hasGroups || !hasProposals || !hasUsers) return;

    const items = buildChairpersonProposalItems({
      proposals: latestProposals,
      groups: latestGroups,
      users: latestUsers,
    });

    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("adminProjectCount", String(items.length));
      }
    } catch {
      // Ignore sessionStorage access errors in restricted environments
    }

    onData(items);
  };

  const unsubGroups: () => void = onSnapshot(
    collection(db, "groups"),
    (snap: any) => {
      latestGroups = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      hasGroups = true;
      emitIfReady();
    },
    (err: unknown) => {
      console.error("Groups listener error:", err);
      onError?.(err);
    }
  );

  const unsubProposals: () => void = onSnapshot(
    collection(db, "proposals"),
    (snap: any) => {
      latestProposals = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      hasProposals = true;
      emitIfReady();
    },
    (err: unknown) => {
      console.error("Proposals listener error:", err);
      onError?.(err);
    }
  );

  const unsubUsers: () => void = onSnapshot(
    collection(db, "users"),
    (snap: any) => {
      latestUsers = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      hasUsers = true;
      emitIfReady();
    },
    (err: unknown) => {
      console.error("Users listener error:", err);
      hasUsers = true;
      onError?.(err);
      emitIfReady();
    }
  );

  return () => {
    isUnsubscribed = true;
    unsubGroups();
    unsubProposals();
    unsubUsers();
  };
};

/**
 * Subscribes to the Chairperson's profile name and unread notifications count,
 * failing gracefully if notifications cannot be queried.
 */
export const subscribeChairpersonHeaderState = (
  uid: string,
  onUpdate: (info: ChairpersonHeaderState) => void
): (() => void) => {
  if (!uid) {
    onUpdate({ userName: "Chairperson", unreadCount: 0 });
    return () => {};
  }

  let currentName = "Chairperson";
  let currentUnread = 0;
  let isUnsubscribed = false;

  const emit = () => {
    if (!isUnsubscribed) {
      onUpdate({
        userName: currentName,
        unreadCount: currentUnread,
      });
    }
  };

  const unsubUser: () => void = onSnapshot(
    doc(db, "users", uid),
    (snap: any) => {
      if (snap.exists()) {
        const data = snap.data() as Record<string, any>;
        const fullName = `${data.firstName || ""} ${data.lastName || ""}`.trim();
        currentName =
          fullName ||
          (typeof data.email === "string" ? data.email.trim() : "") ||
          "Chairperson";
      }
      emit();
    },
    (err: unknown) => {
      console.warn("Chairperson user profile listener error:", err);
      emit();
    }
  );

  const notifQuery = query(
    collection(db, "notifications"),
    where("userId", "==", uid)
  );

  const unsubNotif: () => void = onSnapshot(
    notifQuery,
    (snap: any) => {
      currentUnread = snap.docs.filter(
        (d: any) => (d.data() as Record<string, any>)?.isRead !== true
      ).length;
      emit();
    },
    (err: unknown) => {
      console.warn("Chairperson notifications badge listener error:", err);
      currentUnread = 0;
      emit();
    }
  );

  return () => {
    isUnsubscribed = true;
    unsubUser();
    unsubNotif();
  };
};
