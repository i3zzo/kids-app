// The web preview has no push notifications; reminders work on phones only.
export type PushStatus = 'unsupported' | 'granted' | 'denied' | 'undetermined';
export async function pushStatus(): Promise<PushStatus> {
  return 'unsupported';
}
export async function enablePush(_locale: 'ar' | 'en'): Promise<PushStatus> {
  return 'unsupported';
}
export async function syncPush(_locale: 'ar' | 'en') {}
export async function forgetThisPhone() {}
export async function forgetThisPhoneLocally() {}
export function useNotificationTaps() {}
