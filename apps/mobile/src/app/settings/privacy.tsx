// Privacy and your data: read the notice, download everything we keep, or
// delete the account for good. The database decides what's in the file and
// what gets deleted (export_my_data, delete_my_account); this screen only asks.
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Share } from 'react-native';
import { Button, Card, ErrorText, Field, Muted, Screen, Txt } from '@/components/ui';
import { exportMyData } from '@/lib/api';
import { useI18n } from '@/lib/i18n';
import { useFamily, useSession } from '@/lib/session';
import { colors } from '@/theme';

export default function PrivacySettings() {
  const { t } = useI18n();
  const { role } = useFamily();
  const { deleteAccount } = useSession();
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null);
  const [exported, setExported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');

  async function doExport() {
    setBusy('export');
    setError(null);
    try {
      const json = JSON.stringify(await exportMyData(), null, 2);
      const name = `yahal-data-${new Date().toISOString().slice(0, 10)}.json`;
      if (Platform.OS === 'web') {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        a.download = name;
        a.click();
        URL.revokeObjectURL(a.href);
      } else {
        await Share.share({ title: name, message: json });
      }
      setExported(true);
    } catch {
      setError(t.somethingWrong);
    } finally {
      setBusy(null);
    }
  }

  const word = t.deleteConfirmWord;
  async function doDelete() {
    setBusy('delete');
    setError(null);
    try {
      await deleteAccount();
      // Signed out: the app goes back to the start screen by itself.
    } catch (e) {
      setError((e as { code?: string }).code === '42501' ? t.staffCannotDelete : t.somethingWrong);
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Button title={t.readPrivacyNotice} variant="secondary" onPress={() => router.push('/privacy')} testID="open-notice" />

      <Card>
        <Txt style={{ fontWeight: '700' }}>{t.exportData}</Txt>
        <Muted>{t.exportHint}</Muted>
        <Button title={t.exportData} onPress={doExport} loading={busy === 'export'} disabled={busy !== null} testID="export" />
        {exported ? <Muted>✓ {t.exportReady}</Muted> : null}
      </Card>

      <Card style={{ borderColor: colors.danger }}>
        <Txt style={{ fontWeight: '700', color: colors.danger }}>{t.deleteAccount}</Txt>
        <Txt>{role === 'owner' ? t.deleteOwnerWarning : t.deleteCoParentWarning}</Txt>
        <Field label={t.typeToConfirm} value={confirmText} onChangeText={setConfirmText} autoCapitalize="characters" autoCorrect={false} testID="delete-confirm" />
        <Button
          title={t.deleteNow}
          variant="danger"
          onPress={doDelete}
          loading={busy === 'delete'}
          disabled={busy !== null || confirmText.trim().toUpperCase() !== word.toUpperCase()}
          testID="delete-account"
        />
      </Card>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Screen>
  );
}
