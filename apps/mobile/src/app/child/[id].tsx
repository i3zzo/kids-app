// Edit or delete a child. Changing the birth date moves every vaccination
// that isn't given yet (the database does that).
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ChildForm } from '@/components/ChildForm';
import { Button, ErrorText, Screen, Skeleton } from '@/components/ui';
import { deleteChild, getChild, getChildSupport, saveChildSupport, updateChild } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { useLoad } from '@/lib/useLoad';
import { confirm } from '@/lib/confirm';

export default function EditChild() {
  const { t } = useI18n();
  const { refresh } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error } = useLoad(() => Promise.all([getChild(id), getChildSupport(id)]), [id]);
  const [busy, setBusy] = useState(false);

  if (error) return <Screen><ErrorText>{t.somethingWrong}</ErrorText></Screen>;
  if (!data) return <Screen><Skeleton /></Screen>;

  return (
    <Screen>
      <ChildForm
        initial={data[0]}
        initialSupport={data[1]}
        submitLabel={t.save}
        onSubmit={async (c, support) => {
          await Promise.all([updateChild(id, c), saveChildSupport(id, support)]);
          router.back();
        }}
      />
      <Button
        title={t.delete}
        variant="danger"
        loading={busy}
        onPress={async () => {
          if (!(await confirm(t.deleteChildConfirm, t))) return;
          setBusy(true);
          try {
            await deleteChild(id);
            await refresh(); // if it was the last child, onboarding opens again
            router.back();
          } finally {
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
