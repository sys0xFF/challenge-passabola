// Serviço para o sistema gamificado NEXT 2025
// Este sistema é SEPARADO do site Passa Bola principal
import { database } from './firebase';
import { ref, push, set, get, update, query, orderByChild, limitToLast, remove, onValue, off } from 'firebase/database';
import { BandLink } from './band-service';

// ============= INTERFACES =============

export interface Next2025User {
  id: string;
  name: string;
  email: string;
  password: string; // Hash da senha
  points: number; // Pontos acumulados
  victories: number; // Número de vitórias em eventos
  linkedBands: string[]; // IDs das pulseiras vinculadas
  createdAt: string;
  lastLogin?: string;
}

export interface Next2025Event {
  id: string;
  name: string;
  description: string;
  startTime: string;
  endTime?: string;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  participants: Next2025Participant[];
  winner?: string; // userId do vencedor
  createdAt: string;
}

export interface Next2025Participant {
  userId: string;
  userName: string;
  bandId: string;
  pointsEarned: number;
  joinedAt: string;
}

export interface Next2025Activity {
  id: string;
  userId: string;
  type: 'points_earned' | 'victory' | 'band_linked' | 'reward_redeemed' | 'event_joined';
  description: string;
  points?: number;
  eventId?: string;
  rewardId?: string;
  bandId?: string;
  timestamp: string;
}

export interface Next2025Reward {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  imageUrl?: string;
  quantity: number; // Quantidade disponível
  claimed: number; // Quantidade já resgatada
  status: 'available' | 'out_of_stock';
  createdAt: string;
}

export interface Next2025RewardClaim {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  rewardId: string;
  rewardName: string;
  pointsSpent: number;
  status: 'pending' | 'ready_for_pickup' | 'completed';
  claimedAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  userName: string;
  points: number;
  victories: number;
  rank: number;
}

export interface Next2025Preset {
  id: string;
  name: string;
  axis: ('X' | 'Y' | 'Z')[]; // Array de eixos (1 ou 2 eixos)
  duration: number; // em segundos
  description: string;
  createdAt: string;
}

export interface Next2025Settings {
  pointsMultiplier: number; // multiplicador de pontos (padrão 1.0)
}

// ============= FUNÇÕES DE USUÁRIO =============

/**
 * Criar novo usuário do NEXT 2025
 */
export async function createNext2025User(userData: {
  name: string;
  email: string;
  password: string;
}): Promise<{ success: boolean; userId?: string; error?: any }> {
  try {
    // Verificar se email já existe
    const usersRef = ref(database, 'next2025Users');
    const snapshot = await get(usersRef);
    const users = snapshot.val() || {};
    
    const emailExists = Object.values(users).some(
      (user: any) => user && user.email && user.email.toLowerCase() === userData.email.toLowerCase()
    );
    
    if (emailExists) {
      return { success: false, error: 'Email já cadastrado' };
    }
    
    const newUserRef = push(usersRef);
    const userId = newUserRef.key!;
    
    const user: Next2025User = {
      id: userId,
      name: userData.name,
      email: userData.email,
      password: userData.password, // Em produção, fazer hash da senha
      points: 0,
      victories: 0,
      linkedBands: [],
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
    
    await set(newUserRef, user);
    
    // Registrar atividade
    await addActivity({
      userId,
      type: 'event_joined',
      description: 'Conta criada no NEXT 2025',
      timestamp: new Date().toISOString()
    });
    
    return { success: true, userId };
  } catch (error) {
    console.error('Error creating NEXT 2025 user:', error);
    return { success: false, error };
  }
}

/**
 * Fazer login de usuário
 */
export async function loginNext2025User(
  email: string,
  password: string
): Promise<{ success: boolean; user?: Next2025User; error?: any }> {
  try {
    const usersRef = ref(database, 'next2025Users');
    const snapshot = await get(usersRef);
    const users = snapshot.val() || {};
    
    const userEntry = Object.entries(users).find(
      ([_, user]: [string, any]) =>
        user && 
        user.email && 
        user.email.toLowerCase() === email.toLowerCase() &&
        user.password === password
    );
    
    if (!userEntry) {
      return { success: false, error: 'Email ou senha incorretos' };
    }
    
    const [userId, userData] = userEntry;
    const user = userData as Next2025User;
    
    // Garantir que linkedBands sempre exista
    if (!user.linkedBands) {
      user.linkedBands = [];
    }
    
    // Atualizar último login
    await update(ref(database, `next2025Users/${userId}`), {
      lastLogin: new Date().toISOString()
    });
    
    return { success: true, user };
  } catch (error) {
    console.error('Error logging in NEXT 2025 user:', error);
    return { success: false, error };
  }
}

/**
 * Buscar usuário por ID
 */
export async function getNext2025User(userId: string): Promise<Next2025User | null> {
  try {
    const userRef = ref(database, `next2025Users/${userId}`);
    const snapshot = await get(userRef);
    
    if (!snapshot.exists()) {
      return null;
    }
    
    const user = snapshot.val() as Next2025User;
    
    // Garantir que linkedBands sempre exista (compatibilidade com dados antigos)
    if (!user.linkedBands) {
      user.linkedBands = [];
    }
    
    return user;
  } catch (error) {
    console.error('Error fetching NEXT 2025 user:', error);
    return null;
  }
}

/**
 * Atualizar dados do usuário
 */
export async function updateNext2025User(
  userId: string,
  updates: Partial<Next2025User>
): Promise<{ success: boolean; error?: any }> {
  try {
    const userRef = ref(database, `next2025Users/${userId}`);
    await update(userRef, updates);
    return { success: true };
  } catch (error) {
    console.error('Error updating NEXT 2025 user:', error);
    return { success: false, error };
  }
}

// ============= FUNÇÕES DE PONTOS =============

/**
 * Adicionar pontos ao usuário
 */
export async function addPointsToUser(
  userId: string,
  points: number,
  eventId?: string,
  description?: string
): Promise<{ success: boolean; newTotal?: number; error?: any }> {
  try {
    const user = await getNext2025User(userId);
    if (!user) {
      return { success: false, error: 'Usuário não encontrado' };
    }
    
    const newTotal = user.points + points;
    
    await update(ref(database, `next2025Users/${userId}`), {
      points: newTotal
    });
    
    // Registrar atividade
    await addActivity({
      userId,
      type: 'points_earned',
      description: description || `Ganhou ${points} pontos`,
      points,
      eventId,
      timestamp: new Date().toISOString()
    });
    
    return { success: true, newTotal };
  } catch (error) {
    console.error('Error adding points:', error);
    return { success: false, error };
  }
}

/**
 * Deduzir pontos do usuário (para resgatar recompensas)
 */
export async function deductPointsFromUser(
  userId: string,
  points: number,
  rewardId?: string,
  description?: string
): Promise<{ success: boolean; newTotal?: number; error?: any }> {
  try {
    const user = await getNext2025User(userId);
    if (!user) {
      return { success: false, error: 'Usuário não encontrado' };
    }
    
    if (user.points < points) {
      return { success: false, error: 'Pontos insuficientes' };
    }
    
    const newTotal = user.points - points;
    
    await update(ref(database, `next2025Users/${userId}`), {
      points: newTotal
    });
    
    // Registrar atividade
    await addActivity({
      userId,
      type: 'reward_redeemed',
      description: description || `Resgatou recompensa (-${points} pontos)`,
      points: -points,
      rewardId,
      timestamp: new Date().toISOString()
    });
    
    return { success: true, newTotal };
  } catch (error) {
    console.error('Error deducting points:', error);
    return { success: false, error };
  }
}

/**
 * Adicionar vitória ao usuário
 */
export async function addVictoryToUser(
  userId: string,
  eventId: string
): Promise<{ success: boolean; error?: any }> {
  try {
    const user = await getNext2025User(userId);
    if (!user) {
      return { success: false, error: 'Usuário não encontrado' };
    }
    
    await update(ref(database, `next2025Users/${userId}`), {
      victories: user.victories + 1
    });
    
    // Registrar atividade
    await addActivity({
      userId,
      type: 'victory',
      description: 'Venceu um evento!',
      eventId,
      timestamp: new Date().toISOString()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error adding victory:', error);
    return { success: false, error };
  }
}

// ============= FUNÇÕES DE PULSEIRA =============

/**
 * Vincular pulseira ao usuário do NEXT 2025
 */
export async function linkBandToNext2025User(
  bandId: string,
  userId: string
): Promise<{ success: boolean; error?: any }> {
  try {
    const user = await getNext2025User(userId);
    if (!user) {
      return { success: false, error: 'Usuário não encontrado' };
    }
    
    // Verificar se a pulseira já está vinculada
    if (user.linkedBands.includes(bandId)) {
      return { success: false, error: 'Pulseira já vinculada a este usuário' };
    }
    
    // Verificar se a pulseira está vinculada a outro usuário
    const bandLinkRef = ref(database, `next2025BandLinks/${bandId}`);
    const snapshot = await get(bandLinkRef);
    
    if (snapshot.exists()) {
      const existingLink = snapshot.val();
      if (existingLink.userId !== userId) {
        return { success: false, error: 'Pulseira já vinculada a outro usuário' };
      }
    }
    
    // Criar vínculo
    const bandLink: BandLink = {
      bandId,
      userId,
      userName: user.name,
      userEmail: user.email,
      linkedAt: new Date().toISOString(),
      status: 'linked',
      totalPoints: 0
    };
    
    await set(bandLinkRef, bandLink);
    
    // Atualizar lista de pulseiras do usuário
    const updatedBands = [...user.linkedBands, bandId];
    await update(ref(database, `next2025Users/${userId}`), {
      linkedBands: updatedBands
    });
    
    // Registrar atividade
    await addActivity({
      userId,
      type: 'band_linked',
      description: `Pulseira ${bandId} vinculada`,
      bandId,
      timestamp: new Date().toISOString()
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error linking band:', error);
    return { success: false, error };
  }
}

/**
 * Desvincular pulseira
 */
export async function unlinkBandFromNext2025User(
  bandId: string,
  userId: string
): Promise<{ success: boolean; error?: any }> {
  try {
    const user = await getNext2025User(userId);
    if (!user) {
      return { success: false, error: 'Usuário não encontrado' };
    }
    
    // Remover da lista de pulseiras do usuário
    const updatedBands = user.linkedBands.filter(id => id !== bandId);
    await update(ref(database, `next2025Users/${userId}`), {
      linkedBands: updatedBands
    });
    
    // Remover vínculo
    await remove(ref(database, `next2025BandLinks/${bandId}`));
    
    return { success: true };
  } catch (error) {
    console.error('Error unlinking band:', error);
    return { success: false, error };
  }
}

/**
 * Buscar pulseiras do usuário
 */
export async function getUserBands(userId: string): Promise<BandLink[]> {
  try {
    const user = await getNext2025User(userId);
    if (!user) {
      return [];
    }
    
    const bands: BandLink[] = [];
    
    for (const bandId of user.linkedBands) {
      const bandLinkRef = ref(database, `next2025BandLinks/${bandId}`);
      const snapshot = await get(bandLinkRef);
      
      if (snapshot.exists()) {
        bands.push(snapshot.val());
      }
    }
    
    return bands;
  } catch (error) {
    console.error('Error fetching user bands:', error);
    return [];
  }
}

// ============= FUNÇÕES DE LEADERBOARD =============

/**
 * Buscar top usuários por pontos
 */
export async function getTopUsersByPoints(limit: number = 10): Promise<LeaderboardEntry[]> {
  try {
    const usersRef = ref(database, 'next2025Users');
    const snapshot = await get(usersRef);
    const users = snapshot.val() || {};
    
    const userArray = Object.values(users) as Next2025User[];
    
    // Ordenar por pontos (decrescente)
    const sorted = userArray
      .sort((a, b) => b.points - a.points)
      .slice(0, limit);
    
    // Adicionar ranking
    return sorted.map((user, index) => ({
      userId: user.id,
      userName: user.name,
      points: user.points,
      victories: user.victories,
      rank: index + 1
    }));
  } catch (error) {
    console.error('Error fetching leaderboard by points:', error);
    return [];
  }
}

/**
 * Buscar top usuários por vitórias
 */
export async function getTopUsersByVictories(limit: number = 10): Promise<LeaderboardEntry[]> {
  try {
    const usersRef = ref(database, 'next2025Users');
    const snapshot = await get(usersRef);
    const users = snapshot.val() || {};
    
    const userArray = Object.values(users) as Next2025User[];
    
    // Ordenar por vitórias (decrescente), depois por pontos
    const sorted = userArray
      .sort((a, b) => {
        if (b.victories !== a.victories) {
          return b.victories - a.victories;
        }
        return b.points - a.points;
      })
      .slice(0, limit);
    
    // Adicionar ranking
    return sorted.map((user, index) => ({
      userId: user.id,
      userName: user.name,
      points: user.points,
      victories: user.victories,
      rank: index + 1
    }));
  } catch (error) {
    console.error('Error fetching leaderboard by victories:', error);
    return [];
  }
}

/**
 * Buscar posição do usuário no ranking
 */
export async function getUserRanking(userId: string): Promise<{
  pointsRank: number;
  victoriesRank: number;
  totalUsers: number;
} | null> {
  try {
    const usersRef = ref(database, 'next2025Users');
    const snapshot = await get(usersRef);
    const users = snapshot.val() || {};
    
    const userArray = Object.values(users) as Next2025User[];
    const totalUsers = userArray.length;
    
    // Ranking por pontos
    const sortedByPoints = [...userArray].sort((a, b) => b.points - a.points);
    const pointsRank = sortedByPoints.findIndex(u => u.id === userId) + 1;
    
    // Ranking por vitórias
    const sortedByVictories = [...userArray].sort((a, b) => {
      if (b.victories !== a.victories) {
        return b.victories - a.victories;
      }
      return b.points - a.points;
    });
    const victoriesRank = sortedByVictories.findIndex(u => u.id === userId) + 1;
    
    return {
      pointsRank: pointsRank || totalUsers,
      victoriesRank: victoriesRank || totalUsers,
      totalUsers
    };
  } catch (error) {
    console.error('Error fetching user ranking:', error);
    return null;
  }
}

// ============= FUNÇÕES DE EVENTOS =============

/**
 * Criar novo evento
 */
export async function createEvent(eventData: {
  name: string;
  description: string;
  startTime: string;
}): Promise<{ success: boolean; eventId?: string; error?: any }> {
  try {
    const eventsRef = ref(database, 'next2025Events');
    const newEventRef = push(eventsRef);
    
    const event: Next2025Event = {
      id: newEventRef.key!,
      name: eventData.name,
      description: eventData.description,
      startTime: eventData.startTime,
      status: 'scheduled',
      participants: [],
      createdAt: new Date().toISOString()
    };
    
    await set(newEventRef, event);
    
    return { success: true, eventId: event.id };
  } catch (error) {
    console.error('Error creating event:', error);
    return { success: false, error };
  }
}

/**
 * Finalizar evento e declarar vencedor
 */
export async function finishEvent(
  eventId: string,
  winnerId: string
): Promise<{ success: boolean; error?: any }> {
  try {
    const eventRef = ref(database, `next2025Events/${eventId}`);
    const snapshot = await get(eventRef);
    
    if (!snapshot.exists()) {
      return { success: false, error: 'Evento não encontrado' };
    }
    
    const event = snapshot.val() as Next2025Event;
    
    // Atualizar evento
    await update(eventRef, {
      status: 'completed',
      endTime: new Date().toISOString(),
      winner: winnerId
    });
    
    // Adicionar vitória ao vencedor
    await addVictoryToUser(winnerId, eventId);
    
    // Adicionar pontos aos participantes
    for (const participant of event.participants) {
      if (participant.pointsEarned > 0) {
        await addPointsToUser(
          participant.userId,
          participant.pointsEarned,
          eventId,
          `Ganhou ${participant.pointsEarned} pontos no evento: ${event.name}`
        );
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error finishing event:', error);
    return { success: false, error };
  }
}

// ============= FUNÇÕES DE RECOMPENSAS =============

/**
 * Buscar recompensas disponíveis
 */
export async function getAvailableRewards(): Promise<Next2025Reward[]> {
  try {
    const rewardsRef = ref(database, 'next2025Rewards');
    const snapshot = await get(rewardsRef);
    const rewards = snapshot.val() || {};
    
    return Object.values(rewards).filter(
      (reward: any) => reward.status === 'available' && reward.quantity > reward.claimed
    ) as Next2025Reward[];
  } catch (error) {
    console.error('Error fetching rewards:', error);
    return [];
  }
}

/**
 * Resgatar recompensa
 */
export async function claimReward(
  userId: string,
  rewardId: string
): Promise<{ success: boolean; claimId?: string; error?: any }> {
  try {
    const user = await getNext2025User(userId);
    if (!user) {
      return { success: false, error: 'Usuário não encontrado' };
    }
    
    const rewardRef = ref(database, `next2025Rewards/${rewardId}`);
    const rewardSnapshot = await get(rewardRef);
    
    if (!rewardSnapshot.exists()) {
      return { success: false, error: 'Recompensa não encontrada' };
    }
    
    const reward = rewardSnapshot.val() as Next2025Reward;
    
    // Verificar se há estoque
    if (reward.quantity <= reward.claimed) {
      return { success: false, error: 'Recompensa esgotada' };
    }
    
    // Verificar se usuário tem pontos suficientes
    if (user.points < reward.pointsCost) {
      return { success: false, error: 'Pontos insuficientes' };
    }
    
    // Deduzir pontos
    const deductResult = await deductPointsFromUser(
      userId,
      reward.pointsCost,
      rewardId,
      `Resgatou: ${reward.name}`
    );
    
    if (!deductResult.success) {
      return { success: false, error: deductResult.error };
    }
    
    // Criar registro de resgate
    const claimsRef = ref(database, 'next2025RewardClaims');
    const newClaimRef = push(claimsRef);
    
    const claim: Next2025RewardClaim = {
      id: newClaimRef.key!,
      userId,
      userName: user.name,
      userEmail: user.email,
      rewardId,
      rewardName: reward.name,
      pointsSpent: reward.pointsCost,
      status: 'pending',
      claimedAt: new Date().toISOString()
    };
    
    await set(newClaimRef, claim);
    
    // Atualizar contador de resgates da recompensa
    await update(rewardRef, {
      claimed: reward.claimed + 1,
      status: reward.quantity <= reward.claimed + 1 ? 'out_of_stock' : 'available'
    });
    
    return { success: true, claimId: claim.id };
  } catch (error) {
    console.error('Error claiming reward:', error);
    return { success: false, error };
  }
}

/**
 * Buscar resgates do usuário
 */
export async function getUserClaims(userId: string): Promise<Next2025RewardClaim[]> {
  try {
    const claimsRef = ref(database, 'next2025RewardClaims');
    const snapshot = await get(claimsRef);
    const claims = snapshot.val() || {};
    
    return Object.values(claims).filter(
      (claim: any) => claim.userId === userId
    ).sort((a: any, b: any) => 
      new Date(b.claimedAt).getTime() - new Date(a.claimedAt).getTime()
    ) as Next2025RewardClaim[];
  } catch (error) {
    console.error('Error fetching user claims:', error);
    return [];
  }
}

// ============= FUNÇÕES DE HISTÓRICO =============

/**
 * Adicionar atividade ao histórico
 */
async function addActivity(activityData: Omit<Next2025Activity, 'id'>): Promise<void> {
  try {
    const activitiesRef = ref(database, 'next2025Activities');
    const newActivityRef = push(activitiesRef);
    
    const activity: Next2025Activity = {
      id: newActivityRef.key!,
      ...activityData
    };
    
    // Remover campos undefined antes de salvar no Firebase
    const cleanActivity = Object.fromEntries(
      Object.entries(activity).filter(([_, value]) => value !== undefined)
    ) as Next2025Activity;
    
    await set(newActivityRef, cleanActivity);
  } catch (error) {
    console.error('Error adding activity:', error);
  }
}

/**
 * Buscar histórico de atividades do usuário
 */
export async function getUserActivities(
  userId: string,
  limit?: number
): Promise<Next2025Activity[]> {
  try {
    const activitiesRef = ref(database, 'next2025Activities');
    const snapshot = await get(activitiesRef);
    const activities = snapshot.val() || {};
    
    let userActivities = Object.values(activities).filter(
      (activity: any) => activity.userId === userId
    ) as Next2025Activity[];
    
    // Ordenar por timestamp (mais recente primeiro)
    userActivities = userActivities.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    
    if (limit) {
      userActivities = userActivities.slice(0, limit);
    }
    
    return userActivities;
  } catch (error) {
    console.error('Error fetching user activities:', error);
    return [];
  }
}

// ============= FUNÇÕES PARA DASHBOARD DE PULSEIRAS =============

/**
 * Buscar todas as pulseiras vinculadas do NEXT 2025
 */
export async function getAllNext2025BandLinks(): Promise<BandLink[]> {
  try {
    const bandLinksRef = ref(database, 'next2025BandLinks');
    const snapshot = await get(bandLinksRef);
    const links = snapshot.val() || {};
    
    return Object.values(links) as BandLink[];
  } catch (error) {
    console.error('Error fetching NEXT 2025 band links:', error);
    return [];
  }
}

/**
 * Desvincular pulseira do NEXT 2025 (para dashboard admin)
 */
export async function unlinkNext2025Band(bandId: string): Promise<boolean> {
  try {
    const bandLinkRef = ref(database, `next2025BandLinks/${bandId}`);
    const snapshot = await get(bandLinkRef);
    
    if (!snapshot.exists()) {
      return false;
    }
    
    const bandLink = snapshot.val() as BandLink;
    const userId = bandLink.userId;
    
    // Remover da lista de pulseiras do usuário
    const user = await getNext2025User(userId);
    if (user) {
      const updatedBands = user.linkedBands.filter(id => id !== bandId);
      await update(ref(database, `next2025Users/${userId}`), {
        linkedBands: updatedBands
      });
    }
    
    // Remover vínculo
    await remove(bandLinkRef);
    
    return true;
  } catch (error) {
    console.error('Error unlinking NEXT 2025 band:', error);
    return false;
  }
}

/**
 * Buscar informações de uma pulseira vinculada
 */
export async function getBandLinkInfo(bandId: string): Promise<BandLink | null> {
  try {
    const bandLinkRef = ref(database, `next2025BandLinks/${bandId}`);
    const snapshot = await get(bandLinkRef);
    
    if (!snapshot.exists()) {
      return null;
    }
    
    return snapshot.val() as BandLink;
  } catch (error) {
    console.error('Error fetching band link info:', error);
    return null;
  }
}

/**
 * Escutar mudanças em tempo real de uma pulseira vinculada
 */
export function subscribeToBandLink(
  bandId: string,
  callback: (bandLink: BandLink | null) => void
): () => void {
  const bandLinkRef = ref(database, `next2025BandLinks/${bandId}`);
  
  const unsubscribe = onValue(bandLinkRef, (snapshot) => {
    console.log(`🔔 Band ${bandId} atualizada no Firebase!`);
    if (snapshot.exists()) {
      const bandLink = snapshot.val() as BandLink;
      console.log(`   └─ Usuário: ${bandLink.userName}, Email: ${bandLink.userEmail}`);
      callback(bandLink);
    } else {
      console.log(`   └─ Pulseira desvinculada`);
      callback(null);
    }
  });
  
  return () => off(bandLinkRef, 'value', unsubscribe);
}

/**
 * Adicionar pontos a uma pulseira vinculada do NEXT 2025
 */
export async function addPointsToNext2025Band(
  bandId: string,
  points: number,
  description: string
): Promise<{ success: boolean; error?: any }> {
  try {
    const bandLinkRef = ref(database, `next2025BandLinks/${bandId}`);
    const snapshot = await get(bandLinkRef);
    
    if (!snapshot.exists()) {
      return { success: false, error: 'Pulseira não encontrada' };
    }
    
    const bandLink = snapshot.val() as BandLink;
    const userId = bandLink.userId;
    
    // Adicionar pontos ao usuário
    const result = await addPointsToUser(userId, points, undefined, description);
    
    if (result.success) {
      // Atualizar total de pontos da pulseira
      const newTotal = (bandLink.totalPoints || 0) + points;
      await update(bandLinkRef, {
        totalPoints: newTotal
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error adding points to NEXT 2025 band:', error);
    return { success: false, error };
  }
}

// ============= FUNÇÕES DE PRESETS =============

/**
 * Criar novo preset de movimento
 */
export async function createNext2025Preset(presetData: {
  name: string;
  axis: ('X' | 'Y' | 'Z')[]; // Array de 1 ou 2 eixos
  duration: number;
  description: string;
}): Promise<{ success: boolean; presetId?: string; error?: any }> {
  try {
    const presetsRef = ref(database, 'next2025Config/presets');
    const newPresetRef = push(presetsRef);
    
    const preset: Next2025Preset = {
      id: newPresetRef.key!,
      name: presetData.name,
      axis: presetData.axis,
      duration: presetData.duration,
      description: presetData.description,
      createdAt: new Date().toISOString()
    };
    
    await set(newPresetRef, preset);
    
    return { success: true, presetId: preset.id };
  } catch (error) {
    console.error('Error creating preset:', error);
    return { success: false, error };
  }
}

/**
 * Buscar todos os presets
 */
export async function getNext2025Presets(): Promise<Next2025Preset[]> {
  try {
    const presetsRef = ref(database, 'next2025Config/presets');
    const snapshot = await get(presetsRef);
    
    if (!snapshot.exists()) {
      return [];
    }
    
    const presets = snapshot.val();
    const presetArray = Object.values(presets) as Next2025Preset[];
    
    // Normalizar axis para sempre ser um array (migração de dados antigos)
    return presetArray.map(preset => ({
      ...preset,
      axis: Array.isArray(preset.axis) ? preset.axis : [preset.axis]
    }));
  } catch (error) {
    console.error('Error fetching presets:', error);
    return [];
  }
}

/**
 * Buscar preset por ID
 */
export async function getNext2025Preset(presetId: string): Promise<Next2025Preset | null> {
  try {
    const presetRef = ref(database, `next2025Config/presets/${presetId}`);
    const snapshot = await get(presetRef);
    
    if (!snapshot.exists()) {
      return null;
    }
    
    const preset = snapshot.val() as Next2025Preset;
    
    // Normalizar axis para sempre ser um array (migração de dados antigos)
    return {
      ...preset,
      axis: Array.isArray(preset.axis) ? preset.axis : [preset.axis]
    };
  } catch (error) {
    console.error('Error fetching preset:', error);
    return null;
  }
}

/**
 * Atualizar preset existente
 */
export async function updateNext2025Preset(
  presetId: string,
  updates: Partial<Omit<Next2025Preset, 'id' | 'createdAt'>>
): Promise<{ success: boolean; error?: any }> {
  try {
    const presetRef = ref(database, `next2025Config/presets/${presetId}`);
    await update(presetRef, updates);
    return { success: true };
  } catch (error) {
    console.error('Error updating preset:', error);
    return { success: false, error };
  }
}

/**
 * Deletar preset
 */
export async function deleteNext2025Preset(presetId: string): Promise<{ success: boolean; error?: any }> {
  try {
    const presetRef = ref(database, `next2025Config/presets/${presetId}`);
    await remove(presetRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting preset:', error);
    return { success: false, error };
  }
}

// ============= FUNÇÕES DE CONFIGURAÇÕES =============

/**
 * Buscar configurações do NEXT 2025
 */
export async function getNext2025Settings(): Promise<Next2025Settings> {
  try {
    const settingsRef = ref(database, 'next2025Config/settings');
    const snapshot = await get(settingsRef);
    
    if (!snapshot.exists()) {
      // Retorna valores padrão
      return {
        pointsMultiplier: 1.0
      };
    }
    
    return snapshot.val() as Next2025Settings;
  } catch (error) {
    console.error('Error fetching settings:', error);
    return {
      pointsMultiplier: 1.0
    };
  }
}

/**
 * Atualizar configurações do NEXT 2025
 */
export async function updateNext2025Settings(
  settings: Partial<Next2025Settings>
): Promise<{ success: boolean; error?: any }> {
  try {
    const settingsRef = ref(database, 'next2025Config/settings');
    await update(settingsRef, settings);
    return { success: true };
  } catch (error) {
    console.error('Error updating settings:', error);
    return { success: false, error };
  }
}
