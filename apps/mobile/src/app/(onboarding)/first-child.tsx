// Last onboarding step: add the first child. The database creates the
// child's MOH vaccination schedule straight away.
import { View } from 'react-native';
import { ChildForm } from '@/components/ChildForm';
import { Screen, Title } from '@/components/ui';
import { addChild } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { space } from '@/theme';

export default function FirstChild() {
  const { t } = useI18n();
  const { membership, refresh } = useSession();
  return (
    <Screen>
      <View style={{ marginTop: space.xl }}>
        <Title>{t.addFirstChild}</Title>
      </View>
      <ChildForm
        submitLabel={t.continue}
        onSubmit={async (c) => {
          await addChild(membership!.familyId, c);
          await refresh(); // now "ready": the root layout opens Home
        }}
      />
    </Screen>
  );
}
