// The medical disclaimer shown on every health screen (PRD 10.3), with
// Kuwait's emergency number.
import { Muted } from '@/components/ui';
import { useI18n } from '@/lib/i18n';

export function HealthNote() {
  const { t } = useI18n();
  return <Muted>ⓘ {t.healthNote}</Muted>;
}
