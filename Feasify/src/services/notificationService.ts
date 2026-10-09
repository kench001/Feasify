import { collection, addDoc, doc, updateDoc, deleteDoc, writeBatch, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'proposal' | 'feedback' | 'message' | 'group' | 'system' | 'approval' | 'financial';
  link?: string;
  timestamp: string;
  isRead: boolean;
  rawTime: any;
  senderName?: string;
  metadata?: Record<string, any>;
}

export interface SendNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: 'proposal' | 'feedback' | 'message' | 'group' | 'system' | 'approval' | 'financial';
  link?: string;
  senderName?: string;
  metadata?: Record<string, any>;
}

export const sendNotification = async ({
  userId,
  title,
  message,
  type = 'system',
  link = '',
  senderName = '',
  metadata = {}
}: SendNotificationParams): Promise<string | null> => {
  if (!userId) return null;
  try {
    const docRef = await addDoc(collection(db, "notifications"), {
      userId,
      title,
      message,
      type,
      link,
      senderName,
      metadata,
      isRead: false,
      rawTime: serverTimestamp(),
      createdAt: new Date().toISOString()
    });
    return docRef.id;
  } catch (error) {
    console.error("Failed to send notification:", error);
    return null;
  }
};

export const sendBatchNotification = async (
  userIds: string[],
  params: Omit<SendNotificationParams, 'userId'>
): Promise<void> => {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  try {
    const batch = writeBatch(db);
    uniqueIds.forEach((uid) => {
      const ref = doc(collection(db, "notifications"));
      batch.set(ref, {
        userId: uid,
        title: params.title,
        message: params.message,
        type: params.type || 'system',
        link: params.link || '',
        senderName: params.senderName || '',
        metadata: params.metadata || {},
        isRead: false,
        rawTime: serverTimestamp(),
        createdAt: new Date().toISOString()
      });
    });
    await batch.commit();
  } catch (error) {
    console.error("Failed to send batch notifications:", error);
  }
};

export const markNotificationAsRead = async (notificationId: string): Promise<boolean> => {
  if (!notificationId) return false;
  try {
    await updateDoc(doc(db, "notifications", notificationId), {
      isRead: true,
      readAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error("Failed to mark notification as read:", error);
    return false;
  }
};

export const markNotificationAsUnread = async (notificationId: string): Promise<boolean> => {
  if (!notificationId) return false;
  try {
    await updateDoc(doc(db, "notifications", notificationId), {
      isRead: false
    });
    return true;
  } catch (error) {
    console.error("Failed to mark notification as unread:", error);
    return false;
  }
};

export const markMultipleNotificationsAsRead = async (ids: string[]): Promise<boolean> => {
  if (!ids || ids.length === 0) return false;
  try {
    const batch = writeBatch(db);
    ids.forEach((id) => {
      batch.update(doc(db, "notifications", id), {
        isRead: true,
        readAt: serverTimestamp()
      });
    });
    await batch.commit();
    return true;
  } catch (error) {
    console.error("Failed to mark multiple notifications as read:", error);
    return false;
  }
};

export const markMultipleNotificationsAsUnread = async (ids: string[]): Promise<boolean> => {
  if (!ids || ids.length === 0) return false;
  try {
    const batch = writeBatch(db);
    ids.forEach((id) => {
      batch.update(doc(db, "notifications", id), {
        isRead: false
      });
    });
    await batch.commit();
    return true;
  } catch (error) {
    console.error("Failed to mark multiple notifications as unread:", error);
    return false;
  }
};

export const deleteNotificationDoc = async (notificationId: string): Promise<boolean> => {
  if (!notificationId) return false;
  try {
    await deleteDoc(doc(db, "notifications", notificationId));
    return true;
  } catch (error) {
    console.error("Failed to delete notification:", error);
    return false;
  }
};

export const deleteMultipleNotificationDocs = async (ids: string[]): Promise<boolean> => {
  if (!ids || ids.length === 0) return false;
  try {
    const batch = writeBatch(db);
    ids.forEach((id) => {
      batch.delete(doc(db, "notifications", id));
    });
    await batch.commit();
    return true;
  } catch (error) {
    console.error("Failed to delete multiple notifications:", error);
    return false;
  }
};

export const markAllNotificationsAsReadForUser = async (userId: string): Promise<boolean> => {
  if (!userId) return false;
  try {
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId),
      where("isRead", "==", false)
    );
    const snap = await getDocs(q);
    if (snap.empty) return true;

    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.update(doc(db, "notifications", d.id), {
        isRead: true,
        readAt: serverTimestamp()
      });
    });
    await batch.commit();
    return true;
  } catch (error) {
    console.error("Failed to mark all notifications as read:", error);
    return false;
  }
};

export const notifyAdvisersForSection = async (
  section: string,
  params: Omit<SendNotificationParams, 'userId'>
): Promise<string[]> => {
  if (!section) return [];
  try {
    const advQ = query(collection(db, "users"), where("role", "==", "Adviser"));
    const advSnap = await getDocs(advQ);
    const adviserIds: string[] = [];
    advSnap.forEach((d) => {
      const advData = d.data();
      const secs = (advData.section || "").split(",").map((s: string) => s.trim()).filter(Boolean);
      if (secs.includes(section) || secs.includes("ALL")) {
        adviserIds.push(d.id);
      }
    });

    if (adviserIds.length > 0) {
      await sendBatchNotification(adviserIds, params);
    }
    return adviserIds;
  } catch (error) {
    console.error("Failed to notify advisers for section:", error);
    return [];
  }
};

