// Family: the children, the two parents (with an invite for the second one),
// and settings (language, sign out).
import { router } from 'expo-router';
import { useState } from 'react';
import { Share, View } from 'react-native';
import { Button, Card, Choice, Dot, ErrorText, Muted, Row, Screen, Skeleton, Txt } from '@/components/ui';
import { createInvite, listChildren, listParents } from '@/lib/api';
import { ageLabel } from '@/lib/dates';
import { useI18n } from '@/lib/i18n';
import { useFamily, useSession } from '@/lib/session';
import { useLoad } from '@/lib/useLoad';
import { colors, space } from '@/theme';

export default function Family() {
  const { t, locale, setLocale } = useI18n();
  const { familyId, role } = useFamily();
  const { session, signOut } = useSession();
  const [invite, setInvite] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, error, reload } = useLoad(
    () => Promise.all([listChildren(), listParents(familyId)]).then(([children, parents]) => ({ children, parents })),
    [familyId],
  );

  async function makeInvite() {
    setBusy(true);
    setInviteError(null);
    try {
      const code = await createInvite();
      setInvite(code);
      await Share.share({ message: `${t.inviteShareText} ${code}` }).catch(() => {});
    } catch (e) {
      setInviteError((e as { code?: string }).code === '23514' ? t.familyFull : t.somethingWrong);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Txt style={{ fontSize: 18, fontWeight: '700' }} accessibilityRole="header">{t.children}</Txt>
      {error ? (
        <>
          <ErrorText>{t.somethingWrong}</ErrorText>
          <Button title={t.retry} variant="secondary" onPress={reload} />
        </>
      ) : !data ? (
        <Skeleton lines={3} />
      ) : (
        data.children.map((c) => (
          <Card key={c.id} testID={`child-${c.first_name}`}>
            <Row>
              <Dot color={c.color} size={14} />
              <Txt style={{ fontWeight: '700', fontSize: 18, flex: 1 }}>{c.first_name}</Txt>
              <Muted>{ageLabel(c.birth_date, locale)}</Muted>
            </Row>
            <Row>
              <View style={{ flex: 1 }}>
                <Button title={t.vaccinations} variant="secondary" onPress={() => router.push(`/vaccines/${c.id}`)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title={t.edit} variant="secondary" onPress={() => router.push(`/child/${c.id}`)} />
              </View>
            </Row>
          </Card>
        ))
      )}
      <Button title={`+ ${t.addChild}`} onPress={() => router.push('/child/new')} testID="add-child" />

      <Txt style={{ fontSize: 18, fontWeight: '700', marginTop: space.lg }} accessibilityRole="header">{t.parents}</Txt>
      {data?.parents.map((p) => (
        <Card key={p.user_id}>
          <Row>
            <Txt style={{ flex: 1 }}>
              {p.role === 'owner' ? t.owner : t.coParent} {p.user_id === session?.user.id ? t.you : ''}
            </Txt>
          </Row>
        </Card>
      ))}
      {role === 'owner' && data && data.parents.length < 2 ? (
        <Card style={{ backgroundColor: colors.tealLight, borderColor: colors.tealLight }}>
          {invite ? (
            <>
              <Txt style={{ fontSize: 28, fontWeight: '700', textAlign: 'center', letterSpacing: 4 }} selectable testID="invite-code">
                {invite}
              </Txt>
              <Muted style={{ textAlign: 'center' }}>{t.inviteValid}</Muted>
              <Button title={t.share} variant="secondary" onPress={() => Share.share({ message: `${t.inviteShareText} ${invite}` })} />
            </>
          ) : (
            <Button title={t.inviteCoParent} onPress={makeInvite} loading={busy} testID="invite" />
          )}
          {inviteError ? <ErrorText>{inviteError}</ErrorText> : null}
        </Card>
      ) : null}

      <Txt style={{ fontSize: 18, fontWeight: '700', marginTop: space.lg }} accessibilityRole="header">{t.settings}</Txt>
      <Button title={`🔔 ${t.notifications}`} variant="secondary" onPress={() => router.push('/settings/notifications')} testID="open-notifications" />
      <Choice
        label={t.language}
        value={locale}
        onChange={setLocale}
        options={[
          { value: 'ar', label: 'العربية' },
          { value: 'en', label: 'English' },
        ]}
      />
      <Button title={t.signOut} variant="danger" onPress={signOut} testID="sign-out" />
    </Screen>
  );
}
