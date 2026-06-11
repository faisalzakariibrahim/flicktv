import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { theme } from '../constants/theme';

interface SkeletonCardProps {
  index?: number;
}

export function SkeletonCard({ index = 0 }: SkeletonCardProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const delay = Math.min(index * 80, 600);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1200,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer, index]);

  const bgColor = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.skeleton, theme.colors.skeletonShine],
  });

  return (
    <View style={styles.card}>
      <Animated.View style={[styles.thumb, { backgroundColor: bgColor }]} />
      <View style={styles.info}>
        <Animated.View style={[styles.titleLine, { backgroundColor: bgColor }]} />
        <Animated.View style={[styles.subLine, { backgroundColor: bgColor }]} />
      </View>
    </View>
  );
}

export function SkeletonRow({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} index={i} />
      ))}
    </View>
  );
}

export function SkeletonHero() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [shimmer]);

  const bgColor = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [theme.colors.skeleton, theme.colors.skeletonShine],
  });

  return (
    <View style={styles.hero}>
      <Animated.View style={[styles.heroBg, { backgroundColor: bgColor }]} />
      <View style={styles.heroContent}>
        <Animated.View style={[styles.heroLogo, { backgroundColor: bgColor }]} />
        <View style={styles.heroMeta}>
          <Animated.View style={[styles.heroTitle, { backgroundColor: bgColor }]} />
          <Animated.View style={[styles.heroSub, { backgroundColor: bgColor }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ── Card skeleton ──────────────────────────────────────────────
  card: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  thumb: {
    width: '100%',
    height: 100,
    backgroundColor: theme.colors.skeleton,
  },
  info: { padding: 10 },
  titleLine: {
    height: 12,
    borderRadius: 4,
    width: '80%',
    marginBottom: 6,
  },
  subLine: {
    height: 10,
    borderRadius: 4,
    width: '50%',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: theme.spacing.md,
  },
  // ── Hero skeleton ──────────────────────────────────────────────
  hero: {
    marginHorizontal: theme.spacing.md,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    height: 220,
    marginBottom: theme.spacing.md,
    position: 'relative',
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.skeleton,
  },
  heroContent: {
    position: 'absolute',
    bottom: 56,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 14,
  },
  heroLogo: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: theme.colors.skeleton,
  },
  heroMeta: { flex: 1 },
  heroTitle: {
    height: 16,
    borderRadius: 4,
    width: '70%',
    marginBottom: 8,
  },
  heroSub: {
    height: 12,
    borderRadius: 4,
    width: '40%',
  },
});
