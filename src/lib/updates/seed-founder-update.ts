import { createClient } from "@/lib/supabase/server";

export async function run() {
  const supabase = await createClient();

  await supabase.from("updates").insert([
    {
      title: "CashCaddies Update",
      content: `Update

Message From The Founder
---

Why This Exists

CashCaddies started from a simple problem.

Daily Fantasy Sports, especially golf, has evolved—but the platforms have not kept up. The experience has become cluttered, overly broad, and often favors volume over skill.

The goal with CashCaddies is to rebuild that experience from the ground up.

A cleaner system. A more competitive environment. A platform where progression, structure, and decision-making actually matter.

---

How It Started

This platform did not begin as a template or a prebuilt system.

It was built from scratch, piece by piece, with a focus on long-term scalability instead of shortcuts.

Over the past few weeks, development has been continuous—hundreds of commits, daily iteration, and constant restructuring to get the foundation right before expanding features.

Everything you see is intentional.

---

What Has Been Built So Far

Over the last month, the core systems have been established:

- Account system with secure login
- Wallet system to track balances and activity
- Contest lobby with live contest listings
- Contest entry and lineup building system
- Leaderboards to track performance
- Admin system to manage contests and users
- Updates system to keep users informed

Everything is being built to support a structured, competitive DFS experience.

---

What You Can Do Right Now

Today, a user can:

* Create an account and log in
* Access a working dashboard and wallet
* View contests in the lobby
* Enter contests (based on eligibility and beta access)
* Build lineups using available player pools
* View contest pages and leaderboards
* Navigate a structured application with protected routes

This is not a static site. It is a functioning system.

---

What Is Still Being Built

Some parts of the platform are intentionally not finalized yet:

* Portal progression system (currently functional but using test values in places)
* Full contest lifecycle polish and edge case handling
* Beta access enforcement across every layer
* Real-money and payment system expansion
* UI refinement and performance optimization

The foundation is complete, but refinement is ongoing.

---

What CashCaddies Is Becoming

CashCaddies is being built as:

* A tiered progression-based DFS platform
* A premium competitive environment
* A system that rewards decision-making over volume
* A long-term ecosystem, not a one-time experience

This is not meant to replicate existing DFS platforms.

It is meant to replace the way they operate.

---

Who Is Behind This

CashCaddies is currently being built in a tight, focused development cycle with full control over both product and direction.

Every system—from authentication to contests to the portal—has been designed and implemented directly within this environment.

There is no outsourced foundation.

---

Want Early Access?

Click here to create your account and request beta access.

---

This is the foundation.

Everything from here builds on top of it.`,
      created_at: "2026-04-18T12:00:00.000Z",
    },
  ]);
}
