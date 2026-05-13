"use client";

import { useContext } from "react";
import { UserContext } from "@/contexts/UserContext";

export function useCurrentUser() {
  return useContext(UserContext);
}
