// Sync errors are stored as English text ("<message> (<scraper detail>)").
// The UI matches the message back to its key here and shows the translation from the `syncErrors` messages.
export const SYNC_ERRORS = {
  botBlocked:
    "The bank's bot protection blocked this sync. It usually clears after a few hours (often overnight). Wait and try again.",
  isracardIdMismatch:
    "Isracard rejected your ID and card combination. Double-check the 'Last 6 Digits of Your Card' field - it should be the last 6 digits of your credit card number, NOT your Israeli ID. Re-run setup from the settings drawer to fix it.",
  emptyResponse:
    "The bank returned an empty response. This usually means temporary rate limiting or a flaky endpoint on their side. We'll retry automatically; if it keeps failing, wait a few minutes and try again.",
  network: "Network error reaching the bank. Check your connection and try again.",
  slowSite: "The bank's site took too long to respond. Often temporary - try again in a minute.",
  invalidPassword:
    "The credentials were rejected by the bank. Double-check ID, card last 6 digits, and password.",
  changePassword:
    "The bank is asking you to change your password. Log in via the bank's website first.",
  accountBlocked: "The account is blocked by the bank. Resolve this on the bank's website.",
  timeout: "The scrape timed out. The bank's site may be slow or down. Try again.",
  twoFactor:
    "This account is asking for 2FA. For most banks, turn on 'This account requires 2FA' in the bank's settings so Penny shows the browser and you can solve it manually. For One Zero, make sure the phone number is set on the account.",
  unexpected:
    "The scraper failed unexpectedly. Run with 'Show browser during sync' enabled to see what's happening.",
  // Docker and other headless hosts have no screen, so showing the browser is not an option there.
  unexpectedHeadless:
    "The scraper failed unexpectedly. The bank may have changed its login page. Try again later; if it keeps failing, update Penny.",
  openBankingNoUrl: "Open banking API base URL is missing.",
  openBankingHttps: "Open banking API base URL must start with https://.",
  openBankingUrlCredentials: "Open banking API base URL must not hold a user name or password.",
  openBankingNoToken: "Open banking API access token is missing.",
  openBankingUnreachable: "Open banking endpoint is unreachable.",
  openBankingConsent:
    "The open banking consent has expired or was revoked. Renew the consent with your bank, then paste the new access token here.",
  openBankingNotFound: "Open banking endpoint not found. Check the base URL.",
  openBankingRateLimit: "Open banking rate limit reached. Try again in a few minutes.",
  openBankingFailed: "Open banking request failed.",
  openBankingNotJson: "Open banking returned a response that is not JSON.",
  openBankingNoAccounts:
    "Open banking returned no accounts. Approve the consent for the accounts you want to share.",
  openBankingTooManyPages:
    "Open banking kept returning more pages than expected; nothing was saved.",
  openBankingOtherServer: "Open banking returned a next-page link to a different server.",
  pensionLoginFailed: "The provider did not finish the sign-in or the SMS code step.",
  pensionNoData: "The provider's page showed no products; assets were left as they were.",
  pensionIncomplete: "Some products on the provider's page could not be read; nothing was saved.",
  pensionExportFailed:
    "The provider's portfolio export did not download or could not be read; nothing was saved.",
  pensionUnexpected:
    "The investment house sync stopped unexpectedly; assets were left as they were.",
} as const;

export type SyncErrorKey = keyof typeof SYNC_ERRORS;

export function parseSyncError(message: string): { key: SyncErrorKey | null; detail: string } {
  for (const [key, text] of Object.entries(SYNC_ERRORS) as [SyncErrorKey, string][]) {
    if (message.startsWith(text)) {
      return {
        key,
        detail: message
          .slice(text.length)
          .trim()
          .replace(/^\(([\s\S]*)\)$/, "$1"),
      };
    }
  }
  return { key: null, detail: message };
}
