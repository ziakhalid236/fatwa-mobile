import React from 'react';
import { View } from 'react-native';
import { ProfileView } from '@/components/ProfileView';
import { uiStyles } from '@/components/ui';
import { useApp } from '@/lib/store';

export default function UserProfileScreen({ userId }: { userId: string }) {
  const { profile } = useApp();
  return <View style={uiStyles.screenPadding}><ProfileView userId={userId} self={profile.id === userId} /></View>;
}
