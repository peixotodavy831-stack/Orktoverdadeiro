export function wiaRuntimeLabel(state: unknown) {
  if (state === 'configuration_required') return 'Modelo de linguagem ainda não configurado para este workspace.';
  if (state === 'configured_not_verified') return 'Configuração do modelo encontrada; funcionamento, limites e consumo ainda precisam de validação.';
  return 'Não foi possível confirmar a disponibilidade do modelo.';
}
