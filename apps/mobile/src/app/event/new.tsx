import { router, useLocalSearchParams } from 'expo-router';
import { EventForm } from '@/components/EventForm';
import { Screen, Skeleton } from '@/components/ui';
import { listChildren, saveEvent } from '@/lib/api';
import { parseDay } from '@/lib/dates';
import { useFamily } from '@/lib/session';
import { useLoad } from '@/lib/useLoad';

export default function NewEvent() {
  const { familyId } = useFamily();
  const { day, child } = useLocalSearchParams<{ day?: string; child?: string }>();
  const { data: children } = useLoad(listChildren, []);
  if (!children) return <Screen><Skeleton /></Screen>;

  const start = day ? parseDay(day) : new Date();
  start.setHours(16, 0, 0, 0);

  return (
    <Screen>
      <EventForm
        children={children}
        initial={{ title: '', kind: 'activity', child_id: child || null, starts_at: start.toISOString(), ends_at: null, all_day: false, location: null, notes: null }}
        onSubmit={async (e) => {
          await saveEvent(familyId, null, e);
          router.back();
        }}
      />
    </Screen>
  );
}
