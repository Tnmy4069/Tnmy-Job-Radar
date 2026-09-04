export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "candidate" | "superadmin";
};
