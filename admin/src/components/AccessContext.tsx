import { createContext, useContext } from "react";
import type { AdminAccess, Permission } from "../config/permissions";

const NO_ACCESS: AdminAccess = { isSuper: false, staffRole: "", roleName: "", permissions: [] };

const AccessContext = createContext<AdminAccess>(NO_ACCESS);

export const AccessProvider = AccessContext.Provider;

/** The signed-in admin's role. Use it to hide actions the rules would refuse anyway. */
export const useAccess = () => useContext(AccessContext);

export function useCan(permission: Permission): boolean {
  return useContext(AccessContext).permissions.includes(permission);
}
