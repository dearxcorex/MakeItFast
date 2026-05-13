export type UserRole = "admin" | "inspector";

export type PublicUser = {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  createdAt: string; // ISO
  createdBy: number | null;
};
