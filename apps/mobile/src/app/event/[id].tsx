import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { EventForm } from '@/components/EventForm';
import { Button, ErrorText, Screen, Skeleton } from '@/components/ui';
import { deleteEvent, getEvent, listChildren, saveEvent } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { useI18n } from '@/lib/i18n';
import { useFamily } from '@/lib/session';
import { useLoad } from '@/lib/useLoad';

export default function EditEvent() {
  const { t } = useI18n();
  const { familyId } = useFamily();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error } = useLoad(() => Promise.all([getEvent(id), listChildren()]), [id]);
  const [busy, setBusy] = useState(false);

  if (error) return <Screen><ErrorText>{t.somethingWrong}</ErrorText></Screen>;
  if (!data) return <Screen><Skeleton /></Screen>;
  const [{ id: _id, ...event }, children] = data;

  return (
    <Screen>
      <EventForm
        children={children}
        initial={event}
        onSubmit={async (e) => {
          await saveEvent(familyId, id, e);
          router.back();
        }}
      />
      <Button
        title={t.delete}
        variant="danger"
        loading={busy}
        onPress={async () => {
          if (!(await confirm(t.deleteEventConfirm, t))) return;
          setBusy(true);
          try {
            await deleteEvent(id);
            router.back();
          } finally {
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
