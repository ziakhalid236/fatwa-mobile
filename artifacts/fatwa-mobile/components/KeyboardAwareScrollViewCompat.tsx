import { ScrollView, ScrollViewProps } from 'react-native';

type Props = ScrollViewProps & { enabled?: boolean };

/**
 * Keep the initial route on React Native's built-in scroll view. This avoids
 * mounting an optional native keyboard-controller view during app startup.
 */
export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = 'handled',
  enabled = true,
  ...props
}: Props) {
  return (
    <ScrollView
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      scrollEnabled={enabled}
      {...props}
    >
      {children}
    </ScrollView>
  );
}
