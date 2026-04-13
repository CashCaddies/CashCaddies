"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function useRequireAuth() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session && mounted) {
        window.location.href = "/login";
        return;
      }

      if (mounted) setChecked(true);
    };

    check();

    return () => {
      mounted = false;
    };
  }, []);

  return !checked;
}
