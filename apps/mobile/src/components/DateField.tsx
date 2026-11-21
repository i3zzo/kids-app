// Date / time picker for iOS and Android (the web version is DateField.web.tsx).
// Shows the chosen value as a button; tapping opens the phone's own picker.
import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { formatDay, formatTime, useI18n } from '@/lib/i18n';
import { Txt, styles } from './ui';

type Props = {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  mode?: 'date' | 'time';
  minimumDate?: Date;
  maximumDate?: Date;
};

export function DateField({ label, value, onChange, mode = 'date', minimumDate, maximumDate }: Props) {
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const shown = mode === 'date' ? formatDay(value, locale) : formatTime(value, locale);
  return (
    <View style={{ gap: 4 }}>
      <Txt style={styles.label}>{label}</Txt>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${shown}`} onPress={() => setOpen((o) => !o)} style={[styles.input, { justifyContent: 'center' }]}>
        <Txt>{shown}</Txt>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={value}
          mode={mode}
          locale={locale === 'ar' ? 'ar-KW' : 'en-GB'}
          display={Platform.OS === 'ios' ? (mode === 'date' ? 'inline' : 'spinner') : 'default'}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onValueChange={(_e, d) => {
            if (Platform.OS === 'android') setOpen(false);
            onChange(d);
          }}
          onDismiss={() => setOpen(false)}
        />
      ) : null}
    </View>
  );
}
