import { supabase } from './supabase';

/**
 * Serviço de histórico de conversas do chatbot
 * Salva e recupera conversas na tabela `chat_history` (Supabase/Postgres)
 */

function mapRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    ...(row.data || {}),
    timestamp: new Date(row.created_at),
  };
}

// Salvar mensagem no histórico
export const saveChatMessage = async (userId, message) => {
  try {
    const { error } = await supabase.from('chat_history').insert({
      user_id: userId,
      data: {
        role: message.role, // 'user' ou 'assistant'
        content: message.content,
        sessionId: message.sessionId || generateSessionId(),
        metadata: message.metadata || {},
      },
    });
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Erro ao salvar mensagem do chat:', error);
    return { success: false, error: error.message };
  }
};

// Buscar histórico de conversas
export const getChatHistory = async (userId, limitMessages = 50) => {
  try {
    const { data, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limitMessages);
    if (error) throw error;

    // Reverter para ordem cronológica (mais antiga primeiro)
    const messages = (data || []).map(mapRow).reverse();
    return { success: true, messages };
  } catch (error) {
    console.error('Erro ao buscar histórico do chat:', error);
    return { success: false, error: error.message, messages: [] };
  }
};

// Buscar conversas por sessão
export const getChatSessionHistory = async (userId, sessionId) => {
  try {
    const { data, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', userId)
      .eq('data->>sessionId', sessionId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return { success: true, messages: (data || []).map(mapRow) };
  } catch (error) {
    console.error('Erro ao buscar sessão do chat:', error);
    return { success: false, error: error.message, messages: [] };
  }
};

// Limpar histórico antigo (mensagens com mais de X dias)
export const clearOldChatHistory = async (userId, daysOld = 30) => {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const { data, error } = await supabase
      .from('chat_history')
      .delete()
      .eq('user_id', userId)
      .lt('created_at', cutoffDate.toISOString())
      .select('id');
    if (error) throw error;

    return { success: true, deletedCount: (data || []).length };
  } catch (error) {
    console.error('Erro ao limpar histórico antigo:', error);
    return { success: false, error: error.message };
  }
};

// Gerar ID de sessão único
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Buscar resumo de conversas recentes
export const getChatSummary = async (userId, days = 7) => {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', startDate.toISOString());
    if (error) throw error;

    const summary = {
      totalMessages: 0,
      userMessages: 0,
      assistantMessages: 0,
      topics: [],
      lastActivity: null,
    };

    (data || []).forEach(row => {
      const msgData = row.data || {};
      summary.totalMessages++;

      if (msgData.role === 'user') {
        summary.userMessages++;
      } else {
        summary.assistantMessages++;
      }

      if (!summary.lastActivity || new Date(row.created_at) > new Date(summary.lastActivity)) {
        summary.lastActivity = row.created_at;
      }
    });

    return { success: true, summary };
  } catch (error) {
    console.error('Erro ao buscar resumo do chat:', error);
    return { success: false, error: error.message };
  }
};
