export type PatchEntry = {
  date: string;
  title: string;
  notes: string[];
};

export const PATCHES: PatchEntry[] = [
  {
    date: "March 31 2026",
    title: "Contest Lobby Update",
    notes: [
      "Added create contest button",
      "Improved admin tools",
      "Navigation polish",
      "Protection fund improvements",
    ],
  },
  {
    date: "March 30 2026",
    title: "Foundation Improvements",
    notes: [
      "Admin system stabilized",
      "User approval improvements",
      "Bug fixes",
    ],
  },
];

