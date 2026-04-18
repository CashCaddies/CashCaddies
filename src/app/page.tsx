"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import HomeLoggedIn from "@/components/home-logged-in";

export default function HomePage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user ?? null);
      setLoading(false);
    };

    check();
  }, []);

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (user) {
    return <HomeLoggedIn />;
  }

  return (
    <div className="p-4 text-center">
      <h1 className="text-2xl text-green-400">CashCaddies</h1>
      <p className="mt-2 text-gray-400">Daily Fantasy Golf. Smarter.</p>
    </div>
  );
}
