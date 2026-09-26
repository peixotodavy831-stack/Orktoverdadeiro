import express from 'express';
import crypto from 'crypto';

/**
 * Rotas do Swarm Orkto (Onda 0 / Onda 1)
 *
 * Este módulo registra as rotas do protocolo swarm no app express.
 * Rotas de conversa, mensagens e tarefas de aprovação já estão no
 * api/server.ts (bloco ORKTO Swarm). Este arquivo é o ponto de entrada
 * para futuras extensões do swarm (coordenacao, blackboard, health).
 */
export function registerSwarmRoutes(app: express.Express): void {
  // Healthcheck do swarm
  app.get('/api/swarm/health', (_req, res) => {
    res.json({ status: 'ok', component: 'swarm', timestamp: new Date().toISOString() });
  });

  // Inicializacao do swarm (sentinela initSwarmOrkto)
  app.post('/api/swarm/init', async (req, res) => {
    try {
      // In-memory sentinel: marca que o swarm foi inicializado
      res.json({
        success: true,
        initialized: true,
        timestamp: new Date().toISOString(),
        warning: 'Modo homologação - inicialização simulada',
      });
    } catch (error) {
      console.error('[Swarm] erro no init:', error);
      res.status(500).json({ error: 'Erro ao inicializar swarm' });
    }
  });
}
