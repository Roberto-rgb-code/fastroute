import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { statusColor, theme } from '../theme';

export function Badge({ status }: { status: string }) {
  const c = statusColor[status] ?? { fg: theme.ink500, bg: theme.ink100, label: status };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.fg }]}>{c.label}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'ok';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const bg =
    variant === 'primary'
      ? theme.brand
      : variant === 'danger'
        ? theme.danger
        : variant === 'ok'
          ? theme.ok
          : '#fff';
  const fg = variant === 'ghost' ? theme.ink700 : '#fff';
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.btn,
        { backgroundColor: bg, opacity: disabled || loading ? 0.6 : 1 },
        variant === 'ghost' && styles.btnGhost,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: { borderWidth: 1, borderColor: theme.ink200 },
  btnText: { fontSize: 15, fontWeight: '700' },
  card: {
    backgroundColor: '#fff',
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.ink200,
    padding: 16,
  },
});
