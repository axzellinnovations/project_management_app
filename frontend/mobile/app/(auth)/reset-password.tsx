import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useResetPassword } from '@/src/hooks/useResetPassword';
import BrandHeader from '@/src/components/ui/BrandHeader';
import PasswordInput from '@/src/components/ui/PasswordInput';
import PasswordStrengthBar from '@/src/components/ui/PasswordStrengthBar';
import PrimaryButton from '@/src/components/ui/PrimaryButton';
import ErrorBanner from '@/src/components/ui/ErrorBanner';
import { getPasswordStrength } from '@/src/lib/validation';
import { Colors } from '@/src/constants/colors';
import { shouldUseNativeDriver } from '@/src/lib/platform';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const {
    otp, setOtp,
    newPassword, setNewPassword,
    confirmPassword, setConfirmPassword,
    isLoading, error,
    submitted,
    handleSubmit,
  } = useResetPassword();

  const inputRefs  = useRef<TextInput[]>([]);
  const prevOtp    = useRef(otp);
  const otpChars   = otp.padEnd(6, '').split('').slice(0, 6);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const scaleAnim  = useRef(new Animated.Value(0.5)).current;

  const cardAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(cardAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 60,
      friction: 10,
      delay: 80,
    }).start();
  }, [cardAnim]);

  const cardStyle = {
    opacity: cardAnim,
    transform: [{
      translateY: cardAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [24, 0],
      }),
    }],
  };

  const scaleAnims = useRef([0, 1, 2, 3, 4, 5].map(() => new Animated.Value(1))).current;
  const shakeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (submitted) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 10,
        useNativeDriver: shouldUseNativeDriver,
      }).start();
    }
  }, [submitted]);

  useEffect(() => {
    if (otp.length !== 6) return;
    const timer = setTimeout(handleSubmit, 150);
    return () => clearTimeout(timer);
  }, [otp]);

  useEffect(() => {
    if (error) triggerShake();
  }, [error]);

  const triggerShake = () =>
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 4,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();

  const triggerScale = (index: number) =>
    Animated.sequence([
      Animated.spring(scaleAnims[index], { toValue: 1.05, useNativeDriver: true, tension: 400, friction: 10 }),
      Animated.spring(scaleAnims[index], { toValue: 1.0,  useNativeDriver: true, tension: 200, friction: 15 }),
    ]).start();

  const handleOtpChange = (text: string, index: number) => {
    if (index === 0 && text.length === 6 && /^\d{6}$/.test(text)) {
      setOtp(text);
      inputRefs.current[5]?.focus();
      [0, 1, 2, 3, 4, 5].forEach(i => triggerScale(i));
      return;
    }

    if (!/^\d?$/.test(text)) return;
    const isDeleting = text === '' && prevOtp.current.length >= otp.length;
    setOtp(prev => {
      const chars = prev.padEnd(6, ' ').split('');
      chars[index] = text || ' ';
      const next = chars.join('').replace(/ /g, '');
      prevOtp.current = next;
      if (text && index < 5) setTimeout(() => inputRefs.current[index + 1]?.focus(), 0);
      if (!text && isDeleting && index > 0) setTimeout(() => inputRefs.current[index - 1]?.focus(), 0);
      return next;
    });

    if (text) triggerScale(index);
  };

  const strength = getPasswordStrength(newPassword);

  return (
    <LinearGradient
      colors={['#F0F4FF', '#F8FAFC', '#FDF0FA']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Back */}
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.push('/(auth)/forgot-password')}
            >
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M15 18l-6-6 6-6"
                  stroke={Colors.textPrimary}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </TouchableOpacity>

            {/* Brand */}
            <View style={styles.headerWrapper}>
              <BrandHeader
                title="New Password"
                subtitle="Enter the reset code from your email"
              />
            </View>

            {/* Card */}
            <Animated.View style={cardStyle}>
            <BlurView intensity={20} tint="light" style={styles.card}>
              {!submitted ? (
                <View style={styles.formGap}>
                  <ErrorBanner message={error} visible={!!error} />

                  {/* OTP Input */}
                  <View>
                    <Text style={styles.otpLabel}>Reset Code</Text>
                    <Animated.View style={[styles.otpRow, { transform: [{ translateX: shakeAnim }] }]}>
                      {[0, 1, 2, 3, 4, 5].map(i => (
                        <Animated.View key={i} style={{ transform: [{ scale: scaleAnims[i] }] }}>
                          <TextInput
                            ref={ref => { if (ref) inputRefs.current[i] = ref; }}
                            style={[
                              styles.otpInput,
                              otpChars[i] ? styles.otpInputFilled : null,
                              focusedIndex === i && styles.otpInputFocused,
                            ]}
                            value={otpChars[i] || ''}
                            onChangeText={text => handleOtpChange(text, i)}
                            onFocus={() => setFocusedIndex(i)}
                            onBlur={() => setFocusedIndex(null)}
                            maxLength={i === 0 ? 6 : 1}
                            keyboardType="number-pad"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            textAlign="center"
                            selectTextOnFocus
                          />
                        </Animated.View>
                      ))}
                    </Animated.View>
                  </View>

                  <View>
                    <PasswordInput
                      label="New Password"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Create a new password"
                      textContentType="newPassword"
                      returnKeyType="next"
                    />
                    {newPassword.length > 0 && (
                      <PasswordStrengthBar strength={strength} password={newPassword} />
                    )}
                  </View>

                  <PasswordInput
                    label="Confirm Password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm your new password"
                    textContentType="newPassword"
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                  />

                  <PrimaryButton
                    label="Reset Password"
                    loading={isLoading}
                    onPress={handleSubmit}
                  />
                </View>
              ) : (
                /* Success State */
                <View style={styles.successContainer}>
                  <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                    <LinearGradient
                      colors={['#34D399', '#10B981']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.successIcon}
                    >
                      <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                        <Path
                          d="M5 13l4 4L19 7"
                          stroke="#FFFFFF"
                          strokeWidth={3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </Svg>
                    </LinearGradient>
                  </Animated.View>

                  <Text style={styles.successTitle}>Password Reset Successfully</Text>
                  <Text style={styles.successDesc}>
                    Your password has been updated. You can now sign in.
                  </Text>

                  <View style={styles.successButton}>
                    <PrimaryButton
                      label="Back to Sign In"
                      onPress={() => router.replace('/(auth)/login')}
                    />
                  </View>
                </View>
              )}
            </BlurView>
            </Animated.View>

            <Text style={styles.footer}>© 2026 Planora. All rights reserved.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginLeft: 20,
  },
  headerWrapper: {
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 20,
  },
  card: {
    marginTop: 24,
    marginHorizontal: 20,
    borderRadius: 28,
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255, 255, 255, 0.82)' : 'rgba(255, 255, 255, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    padding: 24,
    ...Platform.select({
      web: { boxShadow: '0 12px 28px rgba(99, 102, 241, 0.12)' },
      default: {
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.12,
        shadowRadius: 28,
      },
    }),
    elevation: 16,
  },
  formGap: {
    gap: 16,
  },
  otpLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  otpInput: {
    width: 48,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E0E7FF',
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    textAlign: 'center',
    padding: 0,
  },
  otpInputFilled: {
    borderColor: Colors.primary,
  },
  otpInputFocused: {
    borderColor: Colors.primary,
    ...Platform.select({
      web: { boxShadow: `0 0 8px ${Colors.primary}40` },
      default: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 3,
      },
    }),
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginTop: 16,
    textAlign: 'center',
  },
  successDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  successButton: {
    alignSelf: 'stretch',
    marginTop: 24,
  },
  footer: {
    fontSize: 11,
    color: '#C0C8D8',
    textAlign: 'center',
    marginTop: 24,
  },
});
