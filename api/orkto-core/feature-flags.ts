/**
 * Feature Flags - Configuração de flags para Onda 0 e Onda 1
 * 
 * Flags controlam a visibilidade de funcionalidades em desenvolvimento.
 * Em produção, devem vir do Supabase ou outra fonte centralizada.
 */

export interface FeatureFlags {
  // Onda 0
  hermesAdapterEnabled: boolean;
  policyEngineEnabled: boolean;
  conversationsEnabled: boolean;
  messagesEnabled: boolean;
  
  // Onda 1
  inboxEnabled: boolean;
  suggestionsEnabled: boolean;
  approvalsEnabled: boolean;
  botsCenterEnabled: boolean;
  dashboardEnabled: boolean;
  
  // Modo de operação
  simulationMode: boolean; // Modo homologação sem envio real
  mockHermesEnabled: boolean;
}

// Flags atuais (em produção, viriam do banco)
const defaultFlags: FeatureFlags = {
  // Onda 0 - Fundação (habilitado para desenvolvimento)
  hermesAdapterEnabled: true,
  policyEngineEnabled: true,
  conversationsEnabled: true,
  messagesEnabled: true,
  
  // Onda 1 - Operação assistida (habilitado para desenvolvimento)
  inboxEnabled: true,
  suggestionsEnabled: true,
  approvalsEnabled: true,
  botsCenterEnabled: true,
  dashboardEnabled: true,
  
  // Modo de operação
  simulationMode: true, // Modo homologação - não envia mensagens reais
  mockHermesEnabled: true, // Usa mock do HermesAdapter
};

let flags: FeatureFlags = { ...defaultFlags };

/**
 * Retorna as flags atuais.
 */
export function getFeatureFlags(): Readonly<FeatureFlags> {
  return { ...flags };
}

/**
 * Verifica se uma flag específica está habilitada.
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  return flags[flag] === true;
}

/**
 * Atualiza as flags (em produção, chamada autenticada).
 */
export function updateFeatureFlags(newFlags: Partial<FeatureFlags>): void {
  flags = { ...flags, ...newFlags };
  console.log('[FeatureFlags] Atualizadas:', newFlags);
}

/**
 * Reseta para as flags padrão.
 */
export function resetFeatureFlags(): void {
  flags = { ...defaultFlags };
  console.log('[FeatureFlags] Resetadas para padrão');
}

/**
 * Retorna o status de release para UI.
 */
export function getReleaseStatus(): {
  currentWave: number;
  deliveredFeatures: string[];
  upcomingFeatures: string[];
  simulationMode: boolean;
} {
  return {
    currentWave: 1,
    deliveredFeatures: [
      'HermesAdapter (mock)',
      'Policy Engine',
      'Inbox operacional',
      'Sugestões de resposta',
      'Central de Bots',
      'Painel Hoje',
    ],
    upcomingFeatures: [
      'Ingestão bidirecional WhatsApp',
      'Aprovação humana com edição',
      'Mood Rings',
      'Sussurro',
      'Orkto Browser',
    ],
    simulationMode: flags.simulationMode,
  };
}
