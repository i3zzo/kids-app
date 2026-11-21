// Add another child.
import { router } from 'expo-router';
import { ChildForm } from '@/components/ChildForm';
import { Screen } from '@/components/ui';
import { addChild } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useFamily } from '@/lib/session';

export default function NewChild() {
  const { t } = useI18n();
  const { familyId } = useFamily();
  return (
    <Screen>
      <ChildForm
        submitLabel={t.save}
        onSubmit={async (c) => {
          await addChild(familyId, c);
          router.back();
        }}
      />
    </Screen>
  );
}
