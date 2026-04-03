export type Contest = {
  id: string;
  name: string;
  prizePool: number;
  entryFee: number;
  entries: number;
};

export type Golfer = {
  id: string;
  name: string;
  salary: number;
};

export const contests: Contest[] = [
  { id: "major-multi", name: "Major Million", prizePool: 1000000, entryFee: 20, entries: 50000 },
  { id: "birdie-boost", name: "Birdie Boost", prizePool: 100000, entryFee: 5, entries: 25000 },
  { id: "green-jacket", name: "Green Jacket Showdown", prizePool: 250000, entryFee: 10, entries: 15000 },
];

export const golfers: Golfer[] = [
  { id: "scheffler", name: "Scottie Scheffler", salary: 11500 },
  { id: "mcilroy", name: "Rory McIlroy", salary: 10900 },
  { id: "schauffele", name: "Xander Schauffele", salary: 10300 },
  { id: "matsuyama", name: "Hideki Matsuyama", salary: 9800 },
  { id: "hovland", name: "Viktor Hovland", salary: 9600 },
  { id: "morikawa", name: "Collin Morikawa", salary: 9500 },
  { id: "cantlay", name: "Patrick Cantlay", salary: 9200 },
  { id: "thomas", name: "Justin Thomas", salary: 9000 },
  { id: "fleetwood", name: "Tommy Fleetwood", salary: 8600 },
  { id: "homa", name: "Max Homa", salary: 8500 },
  { id: "im", name: "Sungjae Im", salary: 8100 },
  { id: "day", name: "Jason Day", salary: 7900 },
];
