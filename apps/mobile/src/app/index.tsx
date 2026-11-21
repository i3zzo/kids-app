// Entry point "/": sends the parent to the right place for their situation.
import { Redirect } from 'expo-router';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';

export default function Index() {
  const { hasChosen } = useI18n();
  const { session, membership, hasChildren } = useSession();
  if (!session) return <Redirect href={hasChosen ? '/sign-in' : '/language'} />;
  if (!membership) return <Redirect href="/create-family" />;
  if (!hasChildren) return <Redirect href="/first-child" />;
  return <Redirect href="/home" />;
}
