// Add another child.
import { router } from 'expo-router';
import { useRef } from 'react';
import { ChildForm } from '@/components/ChildForm';
import { Screen } from '@/components/ui';
import { addChild, saveChildSupport, updateChild } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useFamily } from '@/lib/session';

export default function NewChild() {
  const { t } = useI18n();
  const { familyId } = useFamily();
  // If the child was saved but the special needs part failed, a second tap
  // updates that child instead of adding a duplicate.
  const created = useRef<string | null>(null);
  return (
    <Screen>
      <ChildForm
        submitLabel={t.save}
        onSubmit={async (c, support) => {
          if (created.current) await updateChild(created.current, c);
          else created.current = (await addChild(familyId, c)).id;
          await saveChildSupport(created.current, support);
          router.back();
        }}
      />
    </Screen>
  );
}
