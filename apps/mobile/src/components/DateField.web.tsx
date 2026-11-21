// Web version of DateField: uses the browser's built-in date/time input.
import { createElement } from 'react';
import { View } from 'react-native';
import { toDay } from '@/lib/dates';
import { Txt, styles } from './ui';

type Props = {
  label: string;
  value: Date;
  onChange: (d: Date) => void;
  mode?: 'date' | 'time';
  minimumDate?: Date;
  maximumDate?: Date;
};

const pad = (n: number) => String(n).padStart(2, '0');

export function DateField({ label, value, onChange, mode = 'date', minimumDate, maximumDate }: Props) {
  const str = mode === 'date' ? toDay(value) : `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  return (
    <View style={{ gap: 4 }}>
      <Txt style={styles.label}>{label}</Txt>
      {createElement('input', {
        type: mode,
        value: str,
        'aria-label': label,
        min: mode === 'date' && minimumDate ? toDay(minimumDate) : undefined,
        max: mode === 'date' && maximumDate ? toDay(maximumDate) : undefined,
        onChange: (e: { target: { value: string } }) => {
          const v = e.target.value;
          if (!v) return;
          const d = new Date(value);
          if (mode === 'date') {
            const [y, m, day] = v.split('-').map(Number);
            d.setFullYear(y, m - 1, day);
          } else {
            const [h, min] = v.split(':').map(Number);
            d.setHours(h, min, 0, 0);
          }
          onChange(d);
        },
        style: { fontSize: 17, padding: 12, borderRadius: 12, border: '1px solid #E4E7EB', minHeight: 50, fontFamily: 'inherit' },
      })}
    </View>
  );
}
