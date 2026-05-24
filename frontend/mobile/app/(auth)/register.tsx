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
import { useRegisterForm } from '@/src/hooks/useRegisterForm';
import BrandHeader from '@/src/components/ui/BrandHeader';
import TextInputField from '@/src/components/ui/TextInputField';
import PasswordInput from '@/src/components/ui/PasswordInput';
import PasswordStrengthBar from '@/src/components/ui/PasswordStrengthBar';
import PrimaryButton from '@/src/components/ui/PrimaryButton';
import ErrorBanner from '@/src/components/ui/ErrorBanner';
import { Colors } from '@/src/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TAB_WIDTH = (SCREEN_WIDTH - 40 - 48 - 10) / 2;

export default function RegisterScreen() {
  const router = useRouter();
  const fullNameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const confirmPasswordRef = useRef<TextInput>(null);
  const {
    username, setUsername,
    fullName, setFullName,
    email, setEmail,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    isLoading, error,
    strength,
    handleRegister,
  } = useRegisterForm();

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

  const slideAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: 1,
      tension: 200,
      friction: 20,
      useNativeDriver: true,
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
                title="Create Account"
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
                  <Text style={styles.tabText}>Sign In</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.tab} onPress={() => router.replace('/(auth)/register')}>
                  <Text style={[styles.tabText, styles.tabTextActive]}>Register</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formGap}>
                <ErrorBanner message={error} visible={!!error} />

                <TextInputField
                  label="Username"
                  value={username}
                  onChangeText={t => setUsername(t.trim().toLowerCase())}
                  placeholder="Pick a username"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  submitBehavior="submit"
                  onSubmitEditing={() => fullNameRef.current?.focus()}
                />

                <TextInputField
                  inputRef={fullNameRef}
                  label="Full Name"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="John Doe"
                  autoCapitalize="words"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  submitBehavior="submit"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />

                <TextInputField
                  inputRef={emailRef}
                  label="Email Address"
                  value={email}
                  onChangeText={t => setEmail(t.toLowerCase())}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  submitBehavior="submit"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                />

                <View>
                  <PasswordInput
                    inputRef={passwordRef}
                    label="Password"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Create a password (min 8 chars)"
                    autoComplete="new-password"
                    textContentType="newPassword"
                    returnKeyType="next"
                    blurOnSubmit={false}
                    submitBehavior="submit"
                    onSubmitEditing={() => confirmPasswordRef.current?.focus()}
                  />
                  {password.length > 0 && (
                    <PasswordStrengthBar strength={strength} password={password} />
                  )}
                </View>

                <PasswordInput
                  inputRef={confirmPasswordRef}
                  label="Confirm Password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="done"
                  blurOnSubmit
                  submitBehavior="blurAndSubmit"
                  onSubmitEditing={handleRegister}
                />

                <PrimaryButton
                  label="Create Account"
                  loading={isLoading}
                  onPress={handleRegister}
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
  footer: {
    fontSize: 11,
    color: '#C0C8D8',
    textAlign: 'center',
    marginTop: 24,
  },
});
