"use client";

import Link from "next/link";
import { UserRound } from "lucide-react";
import { useEffect, useState } from "react";

type SessionResponse = {
  user: { displayName: string } | null;
};

export function AccountNav() {
  const [label, setLabel] = useState("Account");

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/account/session", { cache: "no-store" });
        if (!response.ok) return;
        const body = await response.json() as SessionResponse;
        if (active && body.user?.displayName) {
          setLabel(body.user.displayName.split(/\s|@/)[0].slice(0, 18));
        } else if (active) {
          setLabel("Account");
        }
      } catch {
        if (active) setLabel("Account");
      }
    };
    void refresh();
    window.addEventListener("bitemap:account-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("bitemap:account-changed", refresh);
    };
  }, []);

  return <Link className="account-nav" href="/account"><UserRound size={15} /><span>{label}</span></Link>;
}
