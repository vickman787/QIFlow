import { useEffect, useRef } from 'react';
import { View, Text, Animated, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';

const LOGO = 'https://raw.createusercontent.com/4c1916c8-5dfd-43c7-88fb-c7767562deef/';
const { width } = Dimensions.get('window');

export default function Index() {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;
  const ringRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 60, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.timing(ringRotate, { toValue: 1, duration: 1600, useNativeDriver: true })
    ).start();

    const pulseDot = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      ).start();

    pulseDot(dot1, 0);
    pulseDot(dot2, 200);
    pulseDot(dot3, 400);
  }, [fadeAnim, scaleAnim, ringRotate, dot1, dot2, dot3]);

  const spin = ringRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0F2C', paddingTop: insets.top }}>
      <StatusBar style="light" />

      {/* Background glow */}
      <View
        style={{
          position: 'absolute',
          top: '20%',
          left: width / 2 - 120,
          width: 240,
          height: 240,
          borderRadius: 120,
          backgroundColor: '#7B2FBE',
          opacity: 0.15,
        }}
      />
      <View
        style={{
          position: 'absolute',
          top: '25%',
          left: width / 2 - 80,
          width: 160,
          height: 160,
          borderRadius: 80,
          backgroundColor: '#00D4FF',
          opacity: 0.08,
        }}
      />

      {/* Centered content */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        {/* Logo + spinning ring */}
        <Animated.View
          style={{ opacity: fadeAnim, transform: [{ scale: scaleAnim }], alignItems: 'center' }}
        >
          <Animated.View
            style={{
              position: 'absolute',
              width: 104,
              height: 104,
              borderRadius: 24,
              borderWidth: 2.5,
              borderColor: 'transparent',
              borderTopColor: '#00D4FF',
              borderRightColor: '#7B2FBE',
              transform: [{ rotate: spin }],
            }}
          />
          <Image
            source={{ uri: LOGO }}
            style={{ width: 88, height: 88, borderRadius: 20 }}
            contentFit="cover"
          />
        </Animated.View>

        {/* Name + tagline */}
        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center', gap: 6 }}>
          <LinearGradient
            colors={['#00D4FF', '#7B2FBE']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ borderRadius: 4 }}
          >
            <Text
              style={{
                fontSize: 32,
                fontWeight: '900',
                letterSpacing: -0.5,
                color: 'white',
                paddingHorizontal: 2,
              }}
            >
              QIFlow
            </Text>
          </LinearGradient>
          <Text style={{ color: '#8B9CC8', fontSize: 14, textAlign: 'center', marginTop: 2 }}>
            DeFi Lending on QIE Blockchain
          </Text>
        </Animated.View>

        {/* Pulsing dots */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          {([dot1, dot2, dot3] as Animated.Value[]).map((dot, i) => (
            <Animated.View
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#00D4FF',
                opacity: dot,
              }}
            />
          ))}
        </View>
      </View>

      {/* Bottom network badge */}
      <Animated.View
        style={{ opacity: fadeAnim, alignItems: 'center', paddingBottom: insets.bottom + 32 }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 20,
            backgroundColor: '#131B3D',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#00D4FF' }} />
          <Text style={{ color: '#8B9CC8', fontSize: 11, fontWeight: '600' }}>
            QIE Mainnet · Chain ID: 1990
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
