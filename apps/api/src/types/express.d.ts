import type { UserType } from '@meshapp/shared';
import type { RoleName } from '../lib/rbac';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      authUser?: {
        userId: string;
        userType: UserType;
        sessionId: string;
        roles: RoleName[];
      };
    }
  }
}

export {};
