import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export type AuditAction =
  | "CREATE"
  | "UPDATE"
  | "DELETE"
  | "APPROVE"
  | "REJECT"
  | "REVISION"
  | "SUBMIT"
  | "LOGIN";

export interface AuditLogEntry {
  userId: string;
  userName: string;
  userRole: string;
  action: AuditAction;
  /** The exact section code string, e.g. "FM3-4" */
  sectionCode: string;
  description: string;
  recordId?: string;
  oldValue?: any;
  newValue?: any;
}

/**
 * Writes a single audit event to the Firestore `audit_logs` collection.
 * This function is intentionally fire-and-forget — it never throws so it
 * cannot break the caller's normal control flow.
 */
export const logAuditEvent = async (params: AuditLogEntry): Promise<void> => {
  try {
    await addDoc(collection(db, "audit_logs"), {
      userId: params.userId,
      userName: params.userName,
      userRole: params.userRole,
      action: params.action,
      sectionCode: params.sectionCode,
      description: params.description,
      recordId: params.recordId ?? "",
      oldValue: params.oldValue ?? null,
      newValue: params.newValue ?? null,
      status: "success",
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    // Audit failures must never disrupt the main user flow
    console.warn("[AuditLogger] Failed to write audit log:", err);
  }
};
