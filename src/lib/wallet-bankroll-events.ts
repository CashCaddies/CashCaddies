/** Dispatched after a successful contest entry so the header wallet can flash. */
export const WALLET_BANKROLL_FLASH_EVENT = "cashcaddies:wallet-bankroll-flash";

export function dispatchWalletBankrollFlash(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WALLET_BANKROLL_FLASH_EVENT));
}

/** After contest prizes credit (DB sync / settlement); header flashes gold; optional toast uses `detail.amountUsd`. */
export const WALLET_WINNINGS_EVENT = "cashcaddies:wallet-winnings";

export type WalletWinningsDetail = { amountUsd: number };

export function dispatchWalletWinnings(amountUsd: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(WALLET_WINNINGS_EVENT, { detail: { amountUsd } satisfies WalletWinningsDetail }));
}
