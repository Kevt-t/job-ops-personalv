import type { AuthRole } from "@shared/types";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username: string;
        role: AuthRole;
      };
    }
  }
}
