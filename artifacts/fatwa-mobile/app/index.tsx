import { useApp } from '@/lib/store';
import AppShell from '@/screens/Shell';
import OnboardingScreen from '@/screens/OnboardingScreen';

export default function IndexScreen() {
  const { hydrated, onboarded, signedIn } = useApp();
  if (!hydrated) return null;
  // First launch: permissions, then sign-in with Google or email.
  if (!onboarded && !signedIn) return <OnboardingScreen />;
  return <AppShell />;
}
