"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function useRequireAuth() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const currentPath = window.location.pathname;

      // NOT logged in → go to login ONLY
      if (!session) {
        if (currentPath !== "/login") {
          const next = encodeURIComponent(window.location.pathname);
          window.location.href = `/login?next=${next}`;
        }
        return;
      }

      // logged in → DO NOTHING (no redirect!)
      if (mounted) setChecked(true);
    };

    run();

    return () => {
      mounted = false;
    };
  }, []);

  return !checked;
}
