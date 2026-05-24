import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useLoginForm } from '@/src/hooks/useLoginForm';
import BrandHeader from '@/src/components/ui/BrandHeader';
import TextInputField from '@/src/components/ui/TextInputField';
import PasswordInput from '@/src/components/ui/PasswordInput';
import PrimaryButton from '@/src/components/ui/PrimaryButton';
import ErrorBanner from '@/src/components/ui/ErrorBanner';
import { Colors } from '@/src/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// card marginHorizontal 20×2=40, card padding 24×2=48, tabContainer padding 5×2=10
const TAB_WIDTH = (SCREEN_WIDTH - 40 - 48 - 10) / 2;

export default function LoginScreen() {
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);
  const {
    email, setEmail,
    password, setPassword,
    remember, setRemember,
    isLoading, error,
    handleLogin,
  } = useLoginForm();

  const cardAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(cardAnim, {
      toValue: 1,
      useNativeDriver: Platform.OS !== 'web',
      tension: 60,
      friction: 10,
      delay: 80,
    }).start();
  }, [cardAnim]);

  const slideAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 200,
      friction: 20,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, []);

  const cardStyle = {
    opacity: cardAnim,
    transform: [{
      translateY: cardAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [24, 0],
      }),
    }],
  };

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
              onPress={() => router.push('/')}
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
                title="Welcome Back"
                subtitle="Project Management Platform"
              />
            </View>

            {/* Card */}
            <Animated.View style={cardStyle}>
            <BlurView intensity={20} tint="light" style={styles.card}>
              {/* Tab Switcher */}
              <View style={styles.tabContainer}>
                <Animated.View
                  style={[
                    styles.tabPill,
                    {
                      transform: [{
                        translateX: slideAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, TAB_WIDTH],
                        }),
                      }],
                    },
                  ]}
                />
                <TouchableOpacity style={styles.tab} onPress={() => router.replace('/(auth)/login')}>
                  <Text style={[styles.tabText, styles.tabTextActive]}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tab} onPress={() => router.replace('/(auth)/register')}>
                  <Text style={styles.tabText}>Register</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formGap}>
                <ErrorBanner message={error} visible={!!error} />

                <TextInputField
                  label="Email Address"
                  value={email}
                  onChangeText={t => setEmail(t.toLowerCase())}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="username"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  submitBehavior="submit"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />

                <PasswordInput
                  inputRef={passwordRef}
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="done"
                  blurOnSubmit
                  submitBehavior="blurAndSubmit"
                  onSubmitEditing={handleLogin}
                />

                {/* Utilities Row */}
                <View style={styles.utilitiesRow}>
                  <TouchableOpacity
                    style={styles.rememberRow}
                    onPress={() => setRemember(v => !v)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: remember }}
                    accessibilityLabel="Remember me for 30 days"
                  >
                    <Animated.View style={[styles.checkbox, remember && styles.checkboxChecked]}>
                      <Animated.Text style={styles.checkmark}>{remember ? '✓' : ''}</Animated.Text>
                    </Animated.View>
                    <Text style={styles.rememberText}>Remember me for 30 days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
                    <Text style={styles.forgotText}>Forgot password?</Text>
                  </TouchableOpacity>
                </View>

                <PrimaryButton
                  label="Sign In"
                  loading={isLoading}
                  onPress={handleLogin}
                />
              </View>
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F0F4FF',
    borderRadius: 16,
    padding: 5,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  tabPill: {
    position: 'absolute',
    width: TAB_WIDTH,
    height: 40,
    top: 5,
    left: 5,
    borderRadius: 12,
    backgroundColor: Colors.white,
    ...Platform.select({
      web: { boxShadow: '0 1px 8px rgba(21, 93, 252, 0.10)' },
      default: {
        shadowColor: '#155DFC',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.10,
        shadowRadius: 8,
      },
    }),
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textMuted,
  },
  tabTextActive: {
    fontWeight: '700',
    color: Colors.primary,
  },
  formGap: {
    gap: 16,
  },
  utilitiesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingVertical: 4,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: Colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  rememberText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  forgotText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
  },
  footer: {
    fontSize: 11,
    color: '#C0C8D8',
    textAlign: 'center',
    marginTop: 24,
  },
});
