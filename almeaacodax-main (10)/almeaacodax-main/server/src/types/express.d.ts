import type { AppRole } from "../constants/roles.js";

export interface AuthUser {
  id: string;
  email: string;
  role: AppRole;
  name: string;
  schoolId?: string | null;
  groupIds?: string[];
  linkedStudentIds?: string[];
  managedPathIds?: string[];
  managedSubjectIds?: string[];
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
      requestId?: string;
    }
  }
}

export {};
