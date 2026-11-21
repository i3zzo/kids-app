// Shared building blocks so every screen looks the same.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useI18n } from '@/lib/i18n';
import { colors, radius, space } from '@/theme';

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const body = <View style={[padded && styles.padded, { gap: space.lg }]}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive">{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Txt style={styles.title} accessibilityRole="header">{children}</Txt>;
}

/** Text that aligns to the start side (right in Arabic, left in English). */
export function Txt({ style, ...props }: React.ComponentProps<typeof Text>) {
  const { isRTL } = useI18n();
  return <Text {...props} style={[styles.text, { textAlign: isRTL ? 'right' : 'left', writingDirection: isRTL ? 'rtl' : 'ltr' }, style]} />;
}

export function Muted({ children, style }: { children: ReactNode; style?: object }) {
  return <Txt style={[styles.muted, style]}>{children}</Txt>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  testID,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'link';
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
}) {
  const v = buttonVariants[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [styles.button, v.box, (disabled || loading) && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}
    >
      {loading ? <ActivityIndicator color={v.text.color} /> : <Text style={[styles.buttonText, v.text]}>{title}</Text>}
    </Pressable>
  );
}

const buttonVariants = {
  primary: { box: { backgroundColor: colors.teal }, text: { color: colors.white } },
  secondary: { box: { backgroundColor: colors.tealLight }, text: { color: colors.tealDark } },
  danger: { box: { backgroundColor: '#FDECE7' }, text: { color: colors.danger } },
  link: { box: { backgroundColor: 'transparent', minHeight: 40 }, text: { color: colors.teal } },
} as const;

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string | null }) {
  const { isRTL } = useI18n();
  return (
    <View style={{ gap: space.xs }}>
      <Txt style={styles.label}>{label}</Txt>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#9AA3AE"
        {...props}
        style={[styles.input, { textAlign: isRTL ? 'right' : 'left' }, props.multiline && { minHeight: 90, textAlignVertical: 'top' }, props.style]}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return (
    <Txt style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
      {children}
    </Txt>
  );
}

/** A row of pill-shaped choices (gender, event type, child…). */
export function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T | null;
  options: { value: T; label: string; color?: string }[];
  onChange: (v: T) => void;
}) {
  const { isRTL } = useI18n();
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Txt style={styles.label}>{label}</Txt> : null}
      <View style={[styles.choiceRow, isRTL && { flexDirection: 'row-reverse' }]} accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(o.value)}
              accessibilityLabel={o.label}
              style={
                o.color
                  ? [styles.swatch, { backgroundColor: o.color }, selected && { borderColor: colors.ink, borderWidth: 3 }]
                  : [styles.pill, selected && { backgroundColor: colors.teal, borderColor: colors.teal }]
              }
            >
              {o.color ? null : <Text style={[styles.pillText, selected && { color: colors.white }]}>{o.label}</Text>}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Like Choice, but any number can be picked (each pill is a checkbox). */
export function MultiChoice<T extends string>({
  label,
  values,
  options,
  onChange,
  testID,
}: {
  label?: string;
  values: T[];
  options: { value: T; label: string }[];
  onChange: (v: T[]) => void;
  testID?: string;
}) {
  const { isRTL } = useI18n();
  return (
    <View style={{ gap: space.xs }} testID={testID}>
      {label ? <Txt style={styles.label}>{label}</Txt> : null}
      <View style={[styles.choiceRow, isRTL && { flexDirection: 'row-reverse' }]}>
        {options.map((o) => {
          const selected = values.includes(o.value);
          return (
            <Pressable
              key={o.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={o.label}
              onPress={() => onChange(selected ? values.filter((v) => v !== o.value) : [...values, o.value])}
              style={[styles.pill, selected && { backgroundColor: colors.teal, borderColor: colors.teal }]}
            >
              <Text style={[styles.pillText, selected && { color: colors.white }]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Card({ children, style, onPress, testID }: { children: ReactNode; style?: ViewStyle; onPress?: () => void; testID?: string }) {
  if (onPress) {
    return (
      <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.8 }]}>
        {children}
      </Pressable>
    );
  }
  return <View testID={testID} style={[styles.card, style]}>{children}</View>;
}

/** Lays children out start→end, respecting the language direction. */
export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: ViewStyle; gap?: number }) {
  const { isRTL } = useI18n();
  return <View style={[{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/**
 * Grey placeholder blocks shown while data loads — but only if loading takes
 * longer than `delayMs`, so fast responses never flash a skeleton
 * (performance standard item 9).
 */
export function Skeleton({ lines = 3, delayMs = 400 }: { lines?: number; delayMs?: number }) {
  const [visible, setVisible] = useState(false);
  const pulse = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delayMs);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => {
      clearTimeout(t);
      anim.stop();
    };
  }, [delayMs, pulse]);
  if (!visible) return null;
  return (
    <View style={{ gap: space.md }} accessibilityLabel="loading" accessibilityRole="progressbar">
      {Array.from({ length: lines }).map((_, i) => (
        <Animated.View key={i} style={[styles.skeleton, { opacity: pulse, width: i % 2 ? '70%' : '100%' }]} />
      ))}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sandLight },
  padded: { padding: space.lg },
  text: { color: colors.ink, fontSize: 16 },
  title: { fontSize: 24, fontWeight: '700', color: colors.ink },
  muted: { color: colors.muted, fontSize: 14 },
  label: { fontSize: 14, fontWeight: '600', color: colors.ink },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 17,
    color: colors.ink,
    minHeight: 50,
  },
  error: { color: colors.danger, fontSize: 14 },
  button: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  buttonText: { fontSize: 17, fontWeight: '700' },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  pill: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
  },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.line },
  pillText: { fontSize: 15, color: colors.ink, fontWeight: '600' },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: space.lg, gap: space.sm, borderWidth: 1, borderColor: colors.line },
  skeleton: { height: 56, borderRadius: radius.md, backgroundColor: colors.line },
});
