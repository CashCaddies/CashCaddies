"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

export default function useRequireAuth() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
      } else {
        setLoading(false);
      }
    };

    void check();
  }, []);

  return loading;
}
