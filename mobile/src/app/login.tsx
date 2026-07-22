import { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth';

export default function LoginScreen() {
  const { requestMagicLink } = useAuth();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    setSending(true);
    try {
      await requestMagicLink(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar o link');
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="title" style={styles.title}>
            Verifique seu e-mail
          </ThemedText>
          <ThemedText style={styles.text}>
            Enviamos um link de acesso para {email}. Abra o e-mail neste dispositivo e toque no link para entrar.
          </ThemedText>
          <TouchableOpacity onPress={() => setSent(false)}>
            <ThemedText type="link" themeColor="textSecondary">
              Usar outro e-mail
            </ThemedText>
          </TouchableOpacity>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Abastece Aê
        </ThemedText>
        <ThemedText style={styles.text}>Entre com seu e-mail para receber um link de acesso.</ThemedText>

        {error && <ThemedText style={styles.error}>{error}</ThemedText>}

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="seu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        <TouchableOpacity style={styles.button} disabled={sending || !email.includes('@')} onPress={handleSubmit}>
          <ThemedText style={styles.buttonText}>{sending ? 'Enviando...' : 'Enviar link de acesso'}</ThemedText>
        </TouchableOpacity>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.four, gap: Spacing.three },
  title: { textAlign: 'center', fontSize: 32, lineHeight: 40 },
  text: { textAlign: 'center' },
  error: { color: '#ef4444', textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#111111',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
});
