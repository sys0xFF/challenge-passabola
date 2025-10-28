// Serviço para gerenciar eventos de jogo no estilo Nintendo Switch
// 
// ARQUITETURA:
// - GameEvent armazena apenas o CONTROLE do jogo (status, rounds, vencedor)
// - Dados dos usuários (nome, email) vêm em TEMPO REAL de next2025BandLinks
// - Isso permite atualização automática se o vínculo mudar durante o jogo
//
import { database } from './firebase';
import { ref, set, get, update, onValue, off, remove } from 'firebase/database';
import { MovementPreset } from './band-service';

export interface GameRound {
  movement: string;
  duration: number; // em segundos
  axis: ('X' | 'Y' | 'Z')[]; // Array de eixos (1 ou 2)
  preset?: MovementPreset;
}

// Mantemos GameBand para compatibilidade com código existente (será usado apenas em memória no game-display)
export interface GameBand {
  bandId: string;
  userId: string;
  userName: string;
  userEmail: string;
  points: number;
  color: 'blue' | 'red';
}

export type GameStatus = 
  | 'waiting'
  | 'round1_intro'
  | 'round1_countdown'
  | 'round1_active'
  | 'round2_intro'
  | 'round2_countdown'
  | 'round2_active'
  | 'finished';

// GameEvent agora só armazena controle do jogo, não dados dos usuários
export interface GameEvent {
  id: string;
  status: GameStatus;
  createdAt: string;
  rounds: GameRound[];
  currentRound: number; // 0 ou 1
  roundStartTime?: number; // Timestamp do início do round atual
  // IDs das pulseiras participantes (dados dos usuários vêm do Firebase em tempo real)
  bandIds: {
    band010: string; // '010'
    band020: string; // '020'
  };
  winner?: 'band010' | 'band020' | 'tie';
  round1Winner?: 'band010' | 'band020' | 'tie';
  round2Winner?: 'band010' | 'band020' | 'tie';
  autoUnlinkBands?: boolean; // Se true, desvincula as pulseiras após o jogo
  // Mantém bands por compatibilidade temporária, mas será removido em breve
  bands?: {
    band010?: GameBand;
    band020?: GameBand;
  };
}

/**
 * Criar novo evento de jogo
 */
export async function createGameEvent(
  rounds: GameRound[],
  band010: Omit<GameBand, 'points' | 'color'>,
  band020: Omit<GameBand, 'points' | 'color'>,
  autoUnlinkBands: boolean = false
): Promise<{ success: boolean; eventId?: string; error?: any }> {
  try {
    const eventRef = ref(database, 'gameEvents/currentEvent');
    
    console.log('🔍 Verificando evento existente...');
    
    // Verificar se já existe um evento ativo
    const snapshot = await get(eventRef);
    if (snapshot.exists()) {
      const existingEvent = snapshot.val() as GameEvent;
      console.log('📋 Evento existente encontrado:', {
        id: existingEvent.id,
        status: existingEvent.status
      });
      
      if (existingEvent.status !== 'finished' && existingEvent.status !== 'waiting') {
        console.log('❌ Evento ainda está ativo, não pode criar novo');
        return { success: false, error: 'Já existe um evento ativo' };
      }
      
      // IMPORTANTE: Remove o evento antigo primeiro para forçar o onValue a disparar
      console.log('🗑️ Removendo evento antigo (status: ' + existingEvent.status + ')...');
      await remove(eventRef);
      console.log('✓ Evento removido');
      
      // Aguarda um pouco para garantir que o Firebase processou a remoção
      await new Promise(resolve => setTimeout(resolve, 200));
    } else {
      console.log('📭 Nenhum evento existente, criando primeiro evento');
    }
    
    const eventId = Date.now().toString();
    const gameEvent: GameEvent = {
      id: eventId,
      status: 'waiting',
      createdAt: new Date().toISOString(),
      rounds,
      currentRound: 0,
      autoUnlinkBands, // Adiciona a opção de auto-desvincular
      // Apenas IDs das pulseiras - dados dos usuários vêm do Firebase em tempo real
      bandIds: {
        band010: band010.bandId, // Usa o ID real da banda selecionada
        band020: band020.bandId  // Usa o ID real da banda selecionada
      },
      // Mantém bands por compatibilidade temporária
      bands: {
        band010: {
          ...band010,
          points: 0,
          color: 'blue'
        },
        band020: {
          ...band020,
          points: 0,
          color: 'red'
        }
      }
    };
    
    console.log('💾 Salvando novo evento no Firebase:', {
      id: eventId,
      bandIds: gameEvent.bandIds,
      // Dados dos usuários são temporários, virão do Firebase em tempo real
      band010: band010.userName,
      band020: band020.userName
    });
    
    await set(eventRef, gameEvent);
    
    console.log('✅ Evento salvo com sucesso!');
    
    // Verificar se realmente salvou
    const verifySnapshot = await get(eventRef);
    if (verifySnapshot.exists()) {
      const savedEvent = verifySnapshot.val() as GameEvent;
      console.log('✓ Verificação: Evento no Firebase:', {
        id: savedEvent.id,
        bandIds: savedEvent.bandIds,
        status: savedEvent.status
      });
    } else {
      console.error('⚠️ ERRO: Evento não foi encontrado no Firebase após salvar!');
    }
    
    return { success: true, eventId };
  } catch (error) {
    console.error('Error creating game event:', error);
    return { success: false, error };
  }
}

/**
 * Atualizar status do evento
 */
export async function updateGameStatus(status: GameStatus): Promise<boolean> {
  try {
    const eventRef = ref(database, 'gameEvents/currentEvent');
    await update(eventRef, { status });
    return true;
  } catch (error) {
    console.error('Error updating game status:', error);
    return false;
  }
}

/**
 * Atualizar round atual
 */
export async function updateCurrentRound(roundIndex: number): Promise<boolean> {
  try {
    const eventRef = ref(database, 'gameEvents/currentEvent');
    await update(eventRef, { currentRound: roundIndex });
    return true;
  } catch (error) {
    console.error('Error updating current round:', error);
    return false;
  }
}

/**
 * Definir timestamp de início do round
 */
export async function setRoundStartTime(timestamp: number): Promise<boolean> {
  try {
    const eventRef = ref(database, 'gameEvents/currentEvent');
    await update(eventRef, { roundStartTime: timestamp });
    return true;
  } catch (error) {
    console.error('Error setting round start time:', error);
    return false;
  }
}

/**
 * Atualizar pontos de uma pulseira no evento
 */
export async function updateBandPoints(
  bandId: 'band010' | 'band020',
  points: number
): Promise<boolean> {
  try {
    const eventRef = ref(database, `gameEvents/currentEvent/bands/${bandId}`);
    await update(eventRef, { points });
    return true;
  } catch (error) {
    console.error('Error updating band points:', error);
    return false;
  }
}

/**
 * Definir vencedor do round
 */
export async function setRoundWinner(
  roundIndex: number,
  winner: 'band010' | 'band020' | 'tie'
): Promise<boolean> {
  try {
    const eventRef = ref(database, 'gameEvents/currentEvent');
    const field = roundIndex === 0 ? 'round1Winner' : 'round2Winner';
    await update(eventRef, { [field]: winner });
    return true;
  } catch (error) {
    console.error('Error setting round winner:', error);
    return false;
  }
}

/**
 * Definir vencedor final
 */
export async function setGameWinner(
  winner: 'band010' | 'band020' | 'tie'
): Promise<boolean> {
  try {
    const eventRef = ref(database, 'gameEvents/currentEvent');
    await update(eventRef, { 
      winner,
      status: 'finished'
    });
    return true;
  } catch (error) {
    console.error('Error setting game winner:', error);
    return false;
  }
}

/**
 * Buscar evento atual
 */
export async function getCurrentGameEvent(): Promise<GameEvent | null> {
  try {
    const eventRef = ref(database, 'gameEvents/currentEvent');
    const snapshot = await get(eventRef);
    
    if (!snapshot.exists()) {
      return null;
    }
    
    return snapshot.val() as GameEvent;
  } catch (error) {
    console.error('Error fetching game event:', error);
    return null;
  }
}

/**
 * Escutar mudanças no evento em tempo real
 */
export function subscribeToGameEvent(
  callback: (event: GameEvent | null) => void
): () => void {
  const eventRef = ref(database, 'gameEvents/currentEvent');
  
  const unsubscribe = onValue(eventRef, (snapshot) => {
    console.log('🔥 Firebase onValue disparado!', new Date().toLocaleTimeString());
    
    if (snapshot.exists()) {
      const eventData = snapshot.val() as GameEvent;
      console.log('📦 Dados do evento:', {
        id: eventData.id,
        status: eventData.status,
        bandIds: eventData.bandIds,
        // Dados dos usuários agora vêm do Firebase RT via subscribeToBandLink
        note: 'Dados dos usuários serão buscados em tempo real de next2025BandLinks'
      });
      callback(eventData);
    } else {
      console.log('❌ Nenhum evento encontrado no Firebase');
      callback(null);
    }
  });
  
  return () => off(eventRef, 'value', unsubscribe);
}

/**
 * Limpar evento atual
 */
export async function clearGameEvent(): Promise<boolean> {
  try {
    const eventRef = ref(database, 'gameEvents/currentEvent');
    await remove(eventRef);
    return true;
  } catch (error) {
    console.error('Error clearing game event:', error);
    return false;
  }
}

/**
 * Verificar se há evento ativo
 */
export async function hasActiveGameEvent(): Promise<boolean> {
  try {
    const event = await getCurrentGameEvent();
    return event !== null && event.status !== 'finished' && event.status !== 'waiting';
  } catch (error) {
    console.error('Error checking active game event:', error);
    return false;
  }
}
