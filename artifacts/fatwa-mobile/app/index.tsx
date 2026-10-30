import { useApp } from '@/lib/store';
import AppShell from '@/screens/Shell';
import OnboardingScreen from '@/screens/OnboardingScreen';

export default function IndexScreen() {
  const { hydrated, onboarded, signedIn, profile } = useApp();
  if (!hydrated) return null;
  // First launch: permissions, then account. Installs that already have a profile skip it.
  const hasProfile = profile.name.trim().length >= 2 && profile.city.trim().length >= 2;
  if (!onboarded && !signedIn && !hasProfile) return <OnboardingScreen />;
  return <AppShell />;
}
