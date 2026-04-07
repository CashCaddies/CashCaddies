"use client";

import { useEffect, useState } from "react";
import { FeedbackForm } from "@/app/feedback/feedback-form";
import { supabase } from "@/lib/supabase/client";

export default function DashboardFeedbackIdeaPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!supabase) {
        if (!cancelled) setReady(false);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) {
        setReady(Boolean(user));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return <div>Loading...</div>;
  }

  return <FeedbackForm forcedFlow="idea" />;
}
