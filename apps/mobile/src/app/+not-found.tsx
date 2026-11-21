import { Link } from 'expo-router';
import { Screen, Txt } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen>
      <Txt>404</Txt>
      <Link href="/">←</Link>
    </Screen>
  );
}
