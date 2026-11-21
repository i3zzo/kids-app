// Last onboarding step: add the first child. The database creates the
// child's MOH vaccination schedule straight away.
import { useRef } from 'react';
import { View } from 'react-native';
import { ChildForm } from '@/components/ChildForm';
import { Button, Screen, Title } from '@/components/ui';
import { addChild, saveChildSupport, updateChild } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { space } from '@/theme';

export default function FirstChild() {
  const { t } = useI18n();
  const { membership, refresh, signOut } = useSession();
  // If the child was saved but the special needs part failed, a second tap
  // updates that child instead of adding a duplicate.
  const created = useRef<string | null>(null);
  return (
    <Screen>
      <View style={{ marginTop: space.xl }}>
        <Title>{t.addFirstChild}</Title>
      </View>
      <ChildForm
        submitLabel={t.continue}
        onSubmit={async (c, support) => {
          if (created.current) await updateChild(created.current, c);
          else created.current = (await addChild(membership!.familyId, c)).id;
          await saveChildSupport(created.current, support);
          await refresh(); // now "ready": the root layout opens Home
        }}
      />
      <Button title={t.signOut} variant="link" onPress={() => signOut().catch(() => {})} testID="onboarding-sign-out" />
    </Screen>
  );
}
