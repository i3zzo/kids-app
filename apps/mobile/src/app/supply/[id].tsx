import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { SupplyForm } from '@/components/SupplyForm';
import { Button, ErrorText, Screen, Skeleton } from '@/components/ui';
import { deleteSupply, getSupply, updateSupply } from '@/lib/api';
import { confirm } from '@/lib/confirm';
import { useI18n } from '@/lib/i18n';
import { useLoad } from '@/lib/useLoad';

export default function EditSupply() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error } = useLoad(() => getSupply(id), [id]);
  const [busy, setBusy] = useState(false);

  if (error) return <Screen><ErrorText>{t.somethingWrong}</ErrorText></Screen>;
  if (!data) return <Screen><Skeleton /></Screen>;
  const { id: _id, is_low: _l, child_id: _c, suggestion_id: _s, ...item } = data;

  return (
    <Screen>
      <SupplyForm
        initial={item}
        onSubmit={async (s) => {
          await updateSupply(id, s);
          router.back();
        }}
      />
      <Button
        title={t.delete}
        variant="danger"
        loading={busy}
        onPress={async () => {
          if (!(await confirm(t.deleteSupplyConfirm, t))) return;
          setBusy(true);
          try {
            await deleteSupply(id);
            router.back();
          } finally {
            setBusy(false);
          }
        }}
      />
    </Screen>
  );
}
