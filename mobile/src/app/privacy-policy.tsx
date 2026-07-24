import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Spacing } from '@/constants/theme';

const SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. Quem trata os seus dados',
    body:
      'O Abastece Aê é operado por um desenvolvedor independente, responsável pelo tratamento dos dados coletados no app durante esta fase piloto. Dúvidas ou pedidos sobre seus dados podem ser enviados para privacidade@abasteceae.app.',
  },
  {
    title: '2. Quais dados coletamos',
    body:
      'E-mail (para login por link mágico); localização aproximada do dispositivo, apenas enquanto o app está em uso, para mostrar postos próximos e confirmar a proximidade no momento de um "Abasteci aqui" ou report de preço; um identificador do dispositivo, para limitar reports abusivos; os preços, avaliações e abastecimentos que você registra; e o token de notificação push, se você permitir notificações.',
  },
  {
    title: '3. Para que usamos esses dados',
    body:
      'Para mostrar os postos e preços mais relevantes perto de você, confirmar que um report de preço foi feito fisicamente no posto (proteção contra fraude), calcular sua nota de confiança na comunidade, avisar quando o preço de um posto favorito cair, e manter o painel de moderação da equipe.',
  },
  {
    title: '4. Com quem compartilhamos',
    body:
      'Não vendemos seus dados. Usamos alguns prestadores de serviço só para operar o app: Mapbox (mapas e rotas), Resend (envio do e-mail de login) e Expo (envio de notificações push). Cada um processa apenas o mínimo necessário para a função dele.',
  },
  {
    title: '5. Por quanto tempo guardamos',
    body:
      'Enquanto sua conta existir. Se você excluir sua conta, seus dados pessoais (e-mail, sessões, favoritos, token de notificação) são apagados imediatamente. Preços e avaliações que você contribuiu continuam no histórico da comunidade de forma desvinculada da sua identidade, para não corromper o preço de postos que outras pessoas consultam.',
  },
  {
    title: '6. Seus direitos (LGPD)',
    body:
      'Você pode acessar, corrigir ou excluir seus dados a qualquer momento. A exclusão de conta está disponível diretamente em "Minha conta" dentro do app. Para outros pedidos (portabilidade, dúvidas sobre o tratamento), entre em contato pelo e-mail acima.',
  },
  {
    title: '7. Localização',
    body:
      'A localização só é usada em primeiro plano (com o app aberto) — o Abastece Aê não monitora sua localização em segundo plano. Você pode negar o acesso e ainda usar o app normalmente, buscando postos manualmente em vez de por proximidade.',
  },
];

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#111111" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Política de Privacidade</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.updated}>Última atualização: julho de 2026</Text>
          {SECTIONS.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionBody}>{section.body}</Text>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  safeArea: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingHorizontal: Spacing.four,
  },
  backButton: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111111' },

  content: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.six },
  updated: { fontSize: 12, color: '#9ca3af', marginBottom: Spacing.three },

  section: { marginBottom: Spacing.four },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111111', marginBottom: 6 },
  sectionBody: { fontSize: 14, color: '#4b5563', lineHeight: 21 },
});
