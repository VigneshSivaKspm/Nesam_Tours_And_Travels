import React from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import { Button, Card, Notice, Screen } from '../../components/ui';
import { SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../../config/constants';
import { space, type } from '../../theme';

export function AccountHoldScreen({ status, onSignOut }: { status: string; onSignOut: () => void }) {
  return (
    <Screen>
      <Card style={styles.card}>
        <Text style={type.h2}>Account on hold</Text>
        <Text style={[type.body, styles.msg]}>
          {status ? `Your account is currently ${status.toLowerCase()}.` : 'Your account is not active yet.'} Please call {SUPPORT_PHONE_DISPLAY} for help.
        </Text>
        <Button title={`Call ${SUPPORT_PHONE_DISPLAY}`} onPress={() => void Linking.openURL(`tel:${SUPPORT_PHONE}`)} />
        <Button title="Sign out" variant="secondary" onPress={onSignOut} style={styles.gap} />
      </Card>
    </Screen>
  );
}

export function LoadErrorScreen({ message, onRetry, onSignOut }: { message: string; onRetry: () => void; onSignOut: () => void }) {
  return (
    <Screen>
      <Card style={styles.card}>
        <Text style={type.h2}>Couldn’t load your account</Text>
        <Notice message={message} style={styles.gap} />
        <Button title="Try again" onPress={onRetry} />
        <Button title="Sign out" variant="secondary" onPress={onSignOut} style={styles.gap} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: space.xxl },
  msg: { marginVertical: space.md },
  gap: { marginTop: space.md },
});
