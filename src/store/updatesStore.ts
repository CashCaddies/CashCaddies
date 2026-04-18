let updates: any[] = [];

export function getUpdates() {
  return updates;
}

export function addUpdate(update: any) {
  updates = [update, ...updates];
}
