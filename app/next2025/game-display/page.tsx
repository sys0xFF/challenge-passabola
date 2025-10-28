'use client';

import { useEffect, useState, useRef } from 'react';
import { subscribeToGameEvent, updateGameStatus, updateCurrentRound, updateBandPoints, setRoundWinner, setGameWinner, setRoundStartTime, GameEvent, GameBand } from '@/lib/game-service';
import { getBandScores, startEventForAllBands, stopEventForAllBands, controlBandEvent, BandLink } from '@/lib/band-service';
import { addPointsToNext2025Band, getTopUsersByVictories, subscribeToBandLink, LeaderboardEntry, addVictoryToUser, getBandLinkInfo, unlinkNext2025Band } from '@/lib/next2025-service';
import { Trophy, Zap, Crown, Star } from 'lucide-react';

export default function GameDisplayPage() {
  const [gameEvent, setGameEvent] = useState<GameEvent | null>(null);
  const [countdown, setCountdown] = useState<number>(3);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [band1Points, setBand1Points] = useState<number>(0);
  const [band2Points, setBand2Points] = useState<number>(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  
  // States para dados em tempo real das pulseiras
  const [band1Info, setBand1Info] = useState<BandLink | null>(null);
  const [band2Info, setBand2Info] = useState<BandLink | null>(null);
  
  const statusRef = useRef<string>('');
  const roundStartTimeRef = useRef<number>(0);
  const currentEventIdRef = useRef<string>('');
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Escutar mudanças nas pulseiras vinculadas em tempo real
  useEffect(() => {
    if (!gameEvent || !gameEvent.bandIds) return;
    
    console.log('Iniciando listeners das pulseiras...');
    
    const band1Id = gameEvent.bandIds.band010; // Nome mantido para compatibilidade
    const band2Id = gameEvent.bandIds.band020;
    
    // Listener para band 1
    const unsubscribe1 = subscribeToBandLink(band1Id, (bandLink) => {
      console.log(`Band ${band1Id} atualizada:`, bandLink);
      setBand1Info(bandLink);
    });
    
    // Listener para band 2
    const unsubscribe2 = subscribeToBandLink(band2Id, (bandLink) => {
      console.log(`Band ${band2Id} atualizada:`, bandLink);
      setBand2Info(bandLink);
    });
    
    return () => {
      console.log('Parando listeners das pulseiras');
      unsubscribe1();
      unsubscribe2();
    };
  }, [gameEvent?.id]); // Re-inscreve quando o ID do jogo mudar

  // Escutar mudanças no evento
  useEffect(() => {
    const unsubscribe = subscribeToGameEvent((event) => {
      // Detectar se é um novo jogo (ID diferente) ou se não há ID salvo ainda
      const isNewGame = event && (!currentEventIdRef.current || event.id !== currentEventIdRef.current);
      
      if (isNewGame && event) {
        console.log('Novo jogo detectado! ID:', event.id);
        console.log('Band IDs:', event.bandIds);
        console.log('Band 010:', event.bands?.band010?.userName, event.bands?.band010?.userEmail);
        console.log('Band 020:', event.bands?.band020?.userName, event.bands?.band020?.userEmail);
        
        // Limpar countdown anterior se existir
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
        
        // Resetar estados para novo jogo
        currentEventIdRef.current = event.id;
        statusRef.current = '';
        setShowLeaderboard(false);
        setLeaderboardData([]);
        setBand1Points(0);
        setBand2Points(0);
        setCountdown(3);
        setTimeRemaining(0);
      }
      
      // SEMPRE atualiza o gameEvent com os dados mais recentes do Firebase
      // Isso garante que nomes e emails sejam sempre os corretos
      console.log('Atualizando gameEvent com dados do Firebase');
      setGameEvent(event);
      
      // Se é um novo jogo em 'waiting', inicia automaticamente
      if (isNewGame && event && event.status === 'waiting') {
        statusRef.current = 'waiting';
        setTimeout(() => {
          startRound1Intro();
        }, 1000);
      } else if (event && statusRef.current !== event.status) {
        // Sincroniza com o estado atual se já estava em andamento
        statusRef.current = event.status;
        
        // Carrega pontos atuais se estiver em um round ativo
        if (event.status === 'round1_active' || event.status === 'round2_active') {
          updatePoints();
        }
      }
    });
    
    return unsubscribe;
  }, []);

  // Gerenciar contagem regressiva
  useEffect(() => {
    if (gameEvent?.status === 'round1_countdown' || gameEvent?.status === 'round2_countdown') {
      // Limpa qualquer countdown anterior
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
      
      // Reseta para 3 quando entra no countdown
      setCountdown(3);
      
      let currentCount = 3;
      countdownIntervalRef.current = setInterval(() => {
        currentCount--;
        setCountdown(currentCount);
        
        if (currentCount <= 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          // Inicia o round ativo
          if (gameEvent.status === 'round1_countdown') {
            startRound1();
          } else {
            startRound2();
          }
        }
      }, 1000);
      
      return () => {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      };
    }
  }, [gameEvent?.status]);

  // Gerenciar timer do round ativo
  useEffect(() => {
    if (gameEvent?.status === 'round1_active' || gameEvent?.status === 'round2_active') {
      const currentRound = gameEvent.rounds[gameEvent.currentRound];
      
      // Usa o timestamp do Firebase se disponível, caso contrário usa o tempo atual
      const startTime = gameEvent.roundStartTime || Date.now();
      roundStartTimeRef.current = startTime;
      
      // Calcula o tempo já decorrido
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, currentRound.duration - elapsed);
      setTimeRemaining(remaining);
      
      // Se o tempo já acabou, finaliza imediatamente
      if (remaining <= 0) {
        if (gameEvent.status === 'round1_active') {
          finishRound1();
        } else {
          finishRound2();
        }
        return;
      }
      
      const interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - roundStartTimeRef.current) / 1000);
        const remaining = currentRound.duration - elapsed;
        
        if (remaining <= 0) {
          clearInterval(interval);
          setTimeRemaining(0);
          // Finaliza o round
          if (gameEvent.status === 'round1_active') {
            finishRound1();
          } else {
            finishRound2();
          }
        } else {
          setTimeRemaining(remaining);
        }
      }, 100);
      
      // Atualizar pontos em tempo real
      const pointsInterval = setInterval(() => {
        updatePoints();
      }, 1000);
      
      return () => {
        clearInterval(interval);
        clearInterval(pointsInterval);
      };
    }
    
    // IMPORTANTE: Limpa os intervals quando sair do estado ativo
    // Isso previne que updatePoints continue rodando após o jogo terminar
    return () => {
      // Cleanup automático quando o status mudar
    };
  }, [gameEvent?.status, gameEvent?.roundStartTime]);
  
  // Gerenciar leaderboard após finalizar
  useEffect(() => {
    if (gameEvent?.status === 'finished' && !showLeaderboard) {
      // Aguardar 8 segundos antes de mostrar o leaderboard (mais tempo para ver o resultado)
      const timer = setTimeout(() => {
        setShowLeaderboard(true);
        loadLeaderboard();
      }, 8000);
      
      return () => clearTimeout(timer);
    }
  }, [gameEvent?.status, showLeaderboard]);
  
  const loadLeaderboard = async () => {
    try {
      const data = await getTopUsersByVictories(10);
      setLeaderboardData(data);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    }
  };

  // Funções de transição de status
  const startRound1Intro = async () => {
    await updateGameStatus('round1_intro');
    setTimeout(() => {
      startRound1Countdown();
    }, 5000); // 5 segundos mostrando o movimento
  };

  const startRound1Countdown = async () => {
    await updateGameStatus('round1_countdown');
  };

  const startRound1 = async () => {
    if (!gameEvent || !gameEvent.bandIds) return;
    
    const startTime = Date.now();
    await setRoundStartTime(startTime);
    await updateGameStatus('round1_active');
    setBand1Points(0);
    setBand2Points(0);
    
    const band1Id = gameEvent.bandIds.band010;
    const band2Id = gameEvent.bandIds.band020;
    
    // Iniciar evento nas pulseiras
    await startEventForAllBands([band1Id, band2Id]);
  };

  const finishRound1 = async () => {
    if (!gameEvent || !gameEvent.bandIds) return;
    
    console.log('Finalizando Round 1');
    
    const band1Id = gameEvent.bandIds.band010;
    const band2Id = gameEvent.bandIds.band020;
    
    // Parar pulseiras
    await stopEventForAllBands([band1Id, band2Id]);
    
    // Aguardar um pouco para garantir que os dados foram coletados
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Capturar pontos finais
    const finalPoints1 = await getFinalPoints(band1Id);
    const finalPoints2 = await getFinalPoints(band2Id);
    
    console.log(`Round 1 - Band ${band1Id}:`, finalPoints1);
    console.log(`Round 1 - Band ${band2Id}:`, finalPoints2);
    
    setBand1Points(finalPoints1);
    setBand2Points(finalPoints2);
    
    // Determinar vencedor do round
    const winner = finalPoints1 > finalPoints2 ? 'band010' : 
                   finalPoints2 > finalPoints1 ? 'band020' : 'tie';
    await setRoundWinner(0, winner);
    
    console.log('Round 1 Finalizado');
    
    // Aguardar 3 segundos antes de iniciar round 2
    setTimeout(() => {
      startRound2Intro();
    }, 3000);
  };

  const startRound2Intro = async () => {
    await updateCurrentRound(1);
    await updateGameStatus('round2_intro');
    setTimeout(() => {
      startRound2Countdown();
    }, 5000);
  };

  const startRound2Countdown = async () => {
    await updateGameStatus('round2_countdown');
  };

  const startRound2 = async () => {
    if (!gameEvent || !gameEvent.bandIds) return;
    
    const startTime = Date.now();
    await setRoundStartTime(startTime);
    await updateGameStatus('round2_active');
    
    // NÃO reseta os pontos aqui - mantém os do Round 1
    // Os pontos serão somados em updatePoints()
    
    const band1Id = gameEvent.bandIds.band010;
    const band2Id = gameEvent.bandIds.band020;
    
    // Iniciar evento nas pulseiras
    await startEventForAllBands([band1Id, band2Id]);
  };

  const finishRound2 = async () => {
    if (!gameEvent || !gameEvent.bandIds) return;
    
    console.log('Finalizando Round 2');
    
    const band1Id = gameEvent.bandIds.band010;
    const band2Id = gameEvent.bandIds.band020;
    
    // PRIMEIRO: Atualizar o status para 'finished' para parar updatePoints
    await updateGameStatus('finished');
    
    // Parar pulseiras
    await stopEventForAllBands([band1Id, band2Id]);
    
    // Aguardar um pouco para garantir que os dados foram coletados
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Capturar pontos finais do round 2
    const finalPoints1 = await getFinalPoints(band1Id);
    const finalPoints2 = await getFinalPoints(band2Id);
    
    console.log(`Round 2 - Band ${band1Id}:`, finalPoints1);
    console.log(`Round 2 - Band ${band2Id}:`, finalPoints2);
    
    // Somar com pontos do round 1
    const totalPoints1 = band1Points + finalPoints1;
    const totalPoints2 = band2Points + finalPoints2;
    
    console.log(`Total - Band ${band1Id}:`, totalPoints1);
    console.log(`Total - Band ${band2Id}:`, totalPoints2);
    
    setBand1Points(totalPoints1);
    setBand2Points(totalPoints2);
    
    // Determinar vencedor do round 2
    const roundWinner = finalPoints1 > finalPoints2 ? 'band010' : 
                        finalPoints2 > finalPoints1 ? 'band020' : 'tie';
    await setRoundWinner(1, roundWinner);
    
    // Determinar vencedor geral
    const winner = totalPoints1 > totalPoints2 ? 'band010' : 
                   totalPoints2 > totalPoints1 ? 'band020' : 'tie';
    
    console.log('Vencedor geral:', winner);
    
    await setGameWinner(winner);
    
    // Adicionar vitória ao vencedor (se não for empate)
    if (winner === 'band010') {
      const bandLink = await getBandLinkInfo(band1Id);
      if (bandLink) {
        await addVictoryToUser(bandLink.userId, gameEvent.id);
        console.log(`✓ Vitoria adicionada para Band ${band1Id}:`, bandLink.userName);
      }
    } else if (winner === 'band020') {
      const bandLink = await getBandLinkInfo(band2Id);
      if (bandLink) {
        await addVictoryToUser(bandLink.userId, gameEvent.id);
        console.log(`✓ Vitoria adicionada para Band ${band2Id}:`, bandLink.userName);
      }
    }
    
    // Adicionar pontos aos usuários NEXT 2025 (SEMPRE, para ambas as bandas)
    console.log(`Adicionando pontos - Band ${band1Id}: ${totalPoints1}, Band ${band2Id}: ${totalPoints2}`);
    
    try {
      await addPointsToNext2025Band(band1Id, totalPoints1, 'Pontos ganhos no Jogo de Movimento');
      console.log(`✓ Pontos adicionados para Band ${band1Id}`);
    } catch (err) {
      console.error(`Erro ao adicionar pontos para Band ${band1Id}:`, err);
    }
    
    try {
      await addPointsToNext2025Band(band2Id, totalPoints2, 'Pontos ganhos no Jogo de Movimento');
      console.log(`✓ Pontos adicionados para Band ${band2Id}`);
    } catch (err) {
      console.error(`Erro ao adicionar pontos para Band ${band2Id}:`, err);
    }
    
    // Desvincular pulseiras automaticamente se a opção estiver ativada
    if (gameEvent.autoUnlinkBands) {
      console.log('Auto-desvincular ativado, desvinculando pulseiras...');
      try {
        await unlinkNext2025Band(band1Id);
        console.log(`✓ Pulseira ${band1Id} desvinculada`);
      } catch (err) {
        console.error(`Erro ao desvincular pulseira ${band1Id}:`, err);
      }
      
      try {
        await unlinkNext2025Band(band2Id);
        console.log(`✓ Pulseira ${band2Id} desvinculada`);
      } catch (err) {
        console.error(`Erro ao desvincular pulseira ${band2Id}:`, err);
      }
    }
    
    console.log('Round 2 Finalizado');
  };

  const updatePoints = async () => {
    // Para de atualizar se o jogo já terminou
    if (!gameEvent || gameEvent.status === 'finished' || !gameEvent.bandIds) return;
    if (gameEvent.status !== 'round1_active' && gameEvent.status !== 'round2_active') return;
    
    try {
      const band1Id = gameEvent.bandIds.band010;
      const band2Id = gameEvent.bandIds.band020;
      
      const scores1 = await getBandScores(band1Id);
      const scores2 = await getBandScores(band2Id);
      
      const currentRound = gameEvent.rounds[gameEvent.currentRound];
      const axes = currentRound.axis; // Agora é um array
      
      // Soma os pontos de todos os eixos ativos
      let points1 = 0;
      let points2 = 0;
      
      for (const axis of axes) {
        const key = `score${axis}` as 'scoreX' | 'scoreY' | 'scoreZ';
        points1 += Math.abs(scores1[key]?.value || 0);
        points2 += Math.abs(scores2[key]?.value || 0);
      }
      
      if (gameEvent.status === 'round1_active') {
        // Round 1: apenas seta os pontos
        setBand1Points(Math.round(points1));
        setBand2Points(Math.round(points2));
      } else if (gameEvent.status === 'round2_active') {
        // Round 2: NÃO soma aqui! Só mostra os pontos do round 2
        // A soma será feita apenas no finishRound2
        setBand1Points(Math.round(points1));
        setBand2Points(Math.round(points2));
      }
    } catch (error) {
      console.error('Error updating points:', error);
    }
  };

  const getFinalPoints = async (bandId: string): Promise<number> => {
    try {
      const scores = await getBandScores(bandId);
      const axes = gameEvent?.rounds[gameEvent.currentRound].axis || ['Y'];
      
      // Soma os pontos de todos os eixos ativos
      let totalPoints = 0;
      for (const axis of axes) {
        const key = `score${axis}` as 'scoreX' | 'scoreY' | 'scoreZ';
        totalPoints += Math.abs(scores[key]?.value || 0);
      }
      
      return Math.round(totalPoints);
    } catch (error) {
      console.error('Error getting final points:', error);
      return 0;
    }
  };

  if (!gameEvent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 via-blue-900 to-purple-900 animate-gradient flex items-center justify-center relative overflow-hidden">
        {/* Partículas flutuantes de fundo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '0s' }}></div>
          <div className="absolute top-1/3 right-1/4 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
          <div className="absolute bottom-1/4 left-1/3 w-36 h-36 bg-indigo-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }}></div>
          <div className="absolute bottom-1/3 right-1/3 w-28 h-28 bg-pink-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="text-center text-white z-10 space-y-6">
          {/* Ícone de raio com efeito glow */}
          <div className="relative inline-block mb-4">
            <div className="absolute inset-0 animate-shockwave">
              <Zap className="h-16 w-16 mx-auto text-yellow-400 opacity-40" />
            </div>
            <Zap className="h-16 w-16 mx-auto text-yellow-400 animate-glow will-change-transform relative z-10" />
          </div>

          {/* Texto com animação */}
          <div className="space-y-3">
            <p className="text-4xl font-black tracking-tight animate-pulse-slow" style={{
              textShadow: '0 0 20px rgba(251, 191, 36, 0.5), 0 0 40px rgba(251, 191, 36, 0.3)'
            }}>
              AGUARDANDO
            </p>
            <p className="text-2xl font-bold text-yellow-400/90 animate-pulse" style={{ animationDelay: '0.3s' }}>
              Novo Jogo...
            </p>
          </div>

          {/* Barra de loading */}
          <div className="max-w-md mx-auto mt-6">
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 animate-energy"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Extrai dados do evento atual
  const currentRound = gameEvent.rounds[gameEvent.currentRound];
  
  // Extrai os IDs das pulseiras (dinâmico - pode ser 010/020, 030/040, etc)
  const band1Id = gameEvent.bandIds?.band010 || '010'; // Fallback para compatibilidade
  const band2Id = gameEvent.bandIds?.band020 || '020';
  
  console.log('🎮 IDs das pulseiras extraídos:', { band1Id, band2Id, bandIds: gameEvent.bandIds });
  
  // Usa dados em tempo real das pulseiras vinculadas
  // Se não houver dados do Firebase ainda, usa os dados do evento como fallback
  const band1 = band1Info ? {
    bandId: band1Id,
    userId: band1Info.userId,
    userName: band1Info.userName,
    userEmail: band1Info.userEmail,
    points: 0,
    color: 'blue' as const
  } : gameEvent.bands?.band010 || null;
  
  const band2 = band2Info ? {
    bandId: band2Id,
    userId: band2Info.userId,
    userName: band2Info.userName,
    userEmail: band2Info.userEmail,
    points: 0,
    color: 'red' as const
  } : gameEvent.bands?.band020 || null;

  // TELA 1: Intro do Round
  if (gameEvent.status === 'round1_intro' || gameEvent.status === 'round2_intro') {
    const roundNumber = gameEvent.status === 'round1_intro' ? 1 : 2;

    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 via-pink-600 to-rose-600 animate-gradient flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Partículas de fundo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full blur-2xl animate-float"></div>
          <div className="absolute top-1/4 right-20 w-32 h-32 bg-pink-300/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }}></div>
          <div className="absolute bottom-20 left-1/4 w-28 h-28 bg-purple-300/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }}></div>
          <div className="absolute bottom-1/3 right-1/3 w-24 h-24 bg-indigo-300/10 rounded-full blur-2xl animate-float" style={{ animationDelay: '0.5s' }}></div>
        </div>

        <div className="text-center text-white space-y-8 animate-slide-top z-10">
          {/* Título com efeito 3D */}
          <h1
            className="text-6xl font-black tracking-tight will-change-transform animate-pulse-slow"
            style={{
              textShadow: `
                3px 3px 0px rgba(0, 0, 0, 0.3),
                6px 6px 0px rgba(0, 0, 0, 0.2),
                0 0 30px rgba(255, 255, 255, 0.3)
              `
            }}
          >
            {roundNumber === 1 ? 'PRIMEIRO JOGO!' : 'SEGUNDO JOGO!'}
          </h1>

          {/* Card do movimento com glass-morphism e neon */}
          <div className="relative inline-block">
            {/* Borda neon animada */}
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 rounded-3xl blur-xl opacity-60 animate-neon-pulse"></div>

            {/* Card principal */}
            <div className="relative glass-morphism-strong rounded-3xl p-10 border-4 border-white/40 shadow-2xl">
              {/* Estrelas decorativas */}
              <div className="absolute -top-4 -left-4">
                <Star className="h-8 w-8 text-yellow-300 animate-float" />
              </div>
              <div className="absolute -top-4 -right-4">
                <Star className="h-8 w-8 text-pink-300 animate-float" style={{ animationDelay: '1s' }} />
              </div>
              <div className="absolute -bottom-4 -left-4">
                <Star className="h-8 w-8 text-purple-300 animate-float" style={{ animationDelay: '2s' }} />
              </div>
              <div className="absolute -bottom-4 -right-4">
                <Star className="h-8 w-8 text-blue-300 animate-float" style={{ animationDelay: '0.5s' }} />
              </div>

              <p className="text-2xl font-bold mb-4 opacity-90">Movimento:</p>
              <p
                className="text-5xl font-black uppercase tracking-wider"
                style={{
                  textShadow: '0 0 20px rgba(255, 255, 255, 0.5), 0 0 40px rgba(255, 255, 255, 0.3)'
                }}
              >
                {currentRound.movement}
              </p>
            </div>
          </div>

          {/* Texto de preparação */}
          <div className="space-y-3 animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <p className="text-3xl font-bold flex items-center justify-center gap-3">
              <Zap className="h-8 w-8 text-yellow-300 animate-bounce" />
              Prepare-se!
              <Zap className="h-8 w-8 text-yellow-300 animate-bounce" style={{ animationDelay: '0.2s' }} />
            </p>
            <p className="text-xl font-semibold opacity-80">
              O jogo começará em breve...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // TELA 2: Contagem Regressiva
  if (gameEvent.status === 'round1_countdown' || gameEvent.status === 'round2_countdown') {
    // Gradiente dinâmico baseado no countdown
    const gradientColors = countdown === 3
      ? 'from-orange-500 via-amber-500 to-yellow-500'
      : countdown === 2
      ? 'from-red-500 via-rose-500 to-pink-500'
      : 'from-purple-600 via-fuchsia-600 to-pink-600';

    const shadowColor = countdown === 3
      ? 'rgba(251, 191, 36, 0.8)'  // amarelo
      : countdown === 2
      ? 'rgba(244, 63, 94, 0.8)'   // vermelho
      : 'rgba(192, 38, 211, 0.8)'; // roxo

    return (
      <div className={`min-h-screen bg-gradient-to-br ${gradientColors} animate-gradient flex flex-col items-center justify-center p-8 relative overflow-hidden`}>
        {/* Shockwaves múltiplas ao redor do número */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="absolute w-96 h-96 border-8 border-white/30 rounded-full animate-shockwave"></div>
          <div className="absolute w-96 h-96 border-8 border-white/20 rounded-full animate-shockwave" style={{ animationDelay: '0.3s' }}></div>
          <div className="absolute w-96 h-96 border-8 border-white/10 rounded-full animate-shockwave" style={{ animationDelay: '0.6s' }}></div>
        </div>

        <div className="text-center text-white space-y-10 z-10">
          {/* Número gigante com efeito 3D */}
          <div className="relative will-change-transform">
            {/* Explosão de partículas */}
            <div className="absolute inset-0 flex items-center justify-center">
              <Star className="absolute -top-20 left-0 h-12 w-12 text-yellow-200 animate-firework" />
              <Star className="absolute -top-20 right-0 h-12 w-12 text-pink-200 animate-firework" style={{ animationDelay: '0.2s' }} />
              <Star className="absolute top-0 -left-20 h-10 w-10 text-orange-200 animate-firework" style={{ animationDelay: '0.4s' }} />
              <Star className="absolute top-0 -right-20 h-10 w-10 text-red-200 animate-firework" style={{ animationDelay: '0.6s' }} />
            </div>

            <div
              className="text-[14rem] font-black leading-none animate-bounce-slow will-change-transform"
              style={{
                textShadow: `
                  6px 6px 0px rgba(0, 0, 0, 0.4),
                  12px 12px 0px rgba(0, 0, 0, 0.3),
                  0 0 40px ${shadowColor},
                  0 0 80px ${shadowColor}
                `,
                transform: `rotate(${countdown === 1 ? '5deg' : countdown === 2 ? '-3deg' : '0deg'})`
              }}
            >
              {countdown}
            </div>
          </div>

          {/* Card do movimento com glass-morphism */}
          <div className="relative inline-block animate-slide-top">
            {/* Borda brilhante */}
            <div className="absolute inset-0 bg-gradient-to-r from-white via-yellow-200 to-white rounded-3xl blur-2xl opacity-50 animate-pulse"></div>

            <div className="relative glass-morphism-strong rounded-3xl p-8 border-4 border-white/30 shadow-2xl max-w-xl">
              <div className="space-y-4">
                {/* Emoji grande */}
                <div className="text-5xl animate-float">
                  🏃‍♂️
                </div>

                {/* Descrição do movimento */}
                <div className="space-y-2">
                  <p className="text-xl font-bold opacity-90">Execute:</p>
                  <p
                    className="text-3xl font-black uppercase tracking-wide"
                    style={{
                      textShadow: '0 0 20px rgba(255, 255, 255, 0.5)'
                    }}
                  >
                    {currentRound.movement}
                  </p>
                </div>

                {/* Raios decorativos */}
                <div className="flex items-center justify-center gap-3 mt-3">
                  <Zap className="h-6 w-6 text-yellow-300 animate-bounce" />
                  <Zap className="h-6 w-6 text-yellow-300 animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <Zap className="h-6 w-6 text-yellow-300 animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Texto motivacional */}
          <p className="text-3xl font-black animate-pulse-slow tracking-wide"
            style={{
              textShadow: '0 0 20px rgba(255, 255, 255, 0.5)'
            }}
          >
            PREPAREM-SE! 🔥
          </p>
        </div>
      </div>
    );
  }

  // TELA 3: Jogo Ativo
  if (gameEvent.status === 'round1_active' || gameEvent.status === 'round2_active') {
    // Cor do timer baseada no tempo restante
    const timerColorClass = timeRemaining > 60
      ? 'from-green-600 to-green-800'
      : timeRemaining > 30
      ? 'from-yellow-500 to-amber-600'
      : timeRemaining > 10
      ? 'from-orange-500 to-orange-700'
      : 'from-red-600 to-red-800';

    const timerBorderColor = timeRemaining > 60
      ? 'border-green-400'
      : timeRemaining > 30
      ? 'border-yellow-400'
      : timeRemaining > 10
      ? 'border-orange-400'
      : 'border-red-400';

    const timerTextColor = timeRemaining > 60
      ? 'text-green-300'
      : timeRemaining > 30
      ? 'text-yellow-300'
      : timeRemaining > 10
      ? 'text-orange-300'
      : 'text-red-300';

    const shouldPulse = timeRemaining <= 10;

    return (
      <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
        {/* Timer no topo com urgência */}
        <div className={`bg-gradient-to-r ${timerColorClass} border-b-4 ${timerBorderColor} py-4 px-6 relative overflow-hidden ${shouldPulse ? 'animate-pulse' : ''}`}>
          {/* Brilho animado no fundo */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-energy"></div>

          <div className="max-w-7xl mx-auto flex items-center justify-center relative z-10">
            <div className="text-center">
              <p className={`text-xl font-bold ${timerTextColor} mb-2 tracking-wide uppercase`}>
                TEMPO RESTANTE
              </p>
              <div
                className="text-5xl font-black text-white tabular-nums will-change-transform"
                style={{
                  textShadow: shouldPulse
                    ? '0 0 30px rgba(239, 68, 68, 0.8), 0 0 60px rgba(239, 68, 68, 0.5)'
                    : '0 0 20px rgba(0, 0, 0, 0.5)'
                }}
              >
                {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
              </div>
            </div>
          </div>
        </div>

        {/* Área dividida - Azul vs Vermelho */}
        <div className="flex-1 flex relative">
          {/* Divisor central com VS */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
            <div className="relative">
              <div className="absolute inset-0 bg-yellow-400 blur-xl opacity-50 animate-pulse"></div>
              <div className="relative glass-morphism-strong rounded-full w-20 h-20 flex items-center justify-center border-4 border-yellow-400 shadow-2xl">
                <p className="text-2xl font-black text-white" style={{
                  textShadow: '0 0 20px rgba(0, 0, 0, 0.8)'
                }}>VS</p>
              </div>
            </div>
          </div>

          {/* Lado AZUL - Band 010 */}
          <div className="flex-1 bg-gradient-to-br from-cyan-400 via-blue-600 to-indigo-800 flex flex-col items-center justify-center p-12 border-r-4 border-gray-900 relative overflow-hidden">
            {/* Partículas decorativas */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-10 left-10 w-20 h-20 bg-white/5 rounded-full blur-2xl animate-float"></div>
              <div className="absolute top-1/3 left-1/4 w-16 h-16 bg-cyan-300/10 rounded-full blur-xl animate-float" style={{ animationDelay: '1s' }}></div>
              <div className="absolute bottom-20 left-20 w-24 h-24 bg-blue-300/10 rounded-full blur-2xl animate-float" style={{ animationDelay: '2s' }}></div>
              <div className="absolute top-20 right-20 w-12 h-12 bg-indigo-300/10 rounded-full blur-xl animate-float" style={{ animationDelay: '0.5s' }}></div>
            </div>

            {/* Borda lateral com energia fluindo */}
            <div className="absolute right-0 top-0 bottom-0 w-2 bg-gradient-to-b from-cyan-400 via-blue-500 to-indigo-600 animate-energy"></div>

            <div className="text-center space-y-6 text-white relative z-10">
              {/* Badge da pulseira */}
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-blue-400 blur-lg opacity-50 animate-pulse"></div>
                <div className="relative glass-morphism-strong rounded-2xl px-6 py-3 border-2 border-blue-300/50 shadow-2xl">
                  <p className="text-xl font-black tracking-wide">PULSEIRA {band1Id}</p>
                </div>
              </div>

              {/* Card do jogador */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-2xl blur-lg opacity-30"></div>
                <div className="relative glass-morphism-strong rounded-2xl p-4 border-2 border-blue-300/40 shadow-2xl">
                  <p className="text-2xl font-bold mb-1" style={{
                    textShadow: '0 0 15px rgba(59, 130, 246, 0.5)'
                  }}>{band1?.userName}</p>
                  <p className="text-sm opacity-90">{band1?.userEmail}</p>
                </div>
              </div>

              {/* Pontos com efeito metálico */}
              <div className="relative py-4">
                {/* Glow azul */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 bg-blue-400 rounded-full blur-3xl opacity-40 animate-pulse-slow"></div>
                </div>

                <div className="relative">
                  <div
                    className="text-[7rem] font-black tabular-nums text-white will-change-transform"
                    style={{
                      textShadow: `
                        0 0 30px rgba(96, 165, 250, 1),
                        0 0 60px rgba(59, 130, 246, 0.8),
                        4px 4px 0px rgba(0, 0, 0, 0.5),
                        -2px -2px 0px rgba(147, 197, 253, 0.5)
                      `
                    }}
                  >
                    {band1Points}
                  </div>
                  <p className="text-2xl font-black mt-1 tracking-wider text-white" style={{
                    textShadow: '0 0 12px rgba(96, 165, 250, 0.8), 2px 2px 0px rgba(0, 0, 0, 0.3)'
                  }}>PONTOS</p>
                </div>
              </div>

            </div>
          </div>

          {/* Lado VERMELHO - Band 2 */}
          <div className="flex-1 bg-gradient-to-br from-red-400 via-rose-600 to-pink-800 flex flex-col items-center justify-center p-12 relative overflow-hidden">
            {/* Partículas decorativas */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-10 right-10 w-20 h-20 bg-white/5 rounded-full blur-2xl animate-float"></div>
              <div className="absolute top-1/3 right-1/4 w-16 h-16 bg-pink-300/10 rounded-full blur-xl animate-float" style={{ animationDelay: '1.5s' }}></div>
              <div className="absolute bottom-20 right-20 w-24 h-24 bg-rose-300/10 rounded-full blur-2xl animate-float" style={{ animationDelay: '2.5s' }}></div>
              <div className="absolute top-20 left-20 w-12 h-12 bg-red-300/10 rounded-full blur-xl animate-float" style={{ animationDelay: '1s' }}></div>
            </div>

            {/* Borda lateral com energia fluindo */}
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-red-400 via-rose-500 to-pink-600 animate-energy"></div>

            <div className="text-center space-y-6 text-white relative z-10">
              {/* Badge da pulseira */}
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-red-400 blur-lg opacity-50 animate-pulse"></div>
                <div className="relative glass-morphism-strong rounded-2xl px-6 py-3 border-2 border-red-300/50 shadow-2xl">
                  <p className="text-xl font-black tracking-wide">PULSEIRA {band2Id}</p>
                </div>
              </div>

              {/* Card do jogador */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-red-400 to-pink-400 rounded-2xl blur-lg opacity-30"></div>
                <div className="relative glass-morphism-strong rounded-2xl p-4 border-2 border-red-300/40 shadow-2xl">
                  <p className="text-2xl font-bold mb-1" style={{
                    textShadow: '0 0 15px rgba(239, 68, 68, 0.5)'
                  }}>{band2?.userName}</p>
                  <p className="text-sm opacity-90">{band2?.userEmail}</p>
                </div>
              </div>

              {/* Pontos com efeito metálico */}
              <div className="relative py-4">
                {/* Glow vermelho */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 bg-red-400 rounded-full blur-3xl opacity-40 animate-pulse-slow"></div>
                </div>

                <div className="relative">
                  <div
                    className="text-[7rem] font-black tabular-nums text-white will-change-transform"
                    style={{
                      textShadow: `
                        0 0 30px rgba(248, 113, 113, 1),
                        0 0 60px rgba(239, 68, 68, 0.8),
                        4px 4px 0px rgba(0, 0, 0, 0.5),
                        -2px -2px 0px rgba(252, 165, 165, 0.5)
                      `
                    }}
                  >
                    {band2Points}
                  </div>
                  <p className="text-2xl font-black mt-1 tracking-wider text-white" style={{
                    textShadow: '0 0 12px rgba(248, 113, 113, 0.8), 2px 2px 0px rgba(0, 0, 0, 0.3)'
                  }}>PONTOS</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    );
  }

  // TELA 4: Resultado Final (5 segundos) ou Leaderboard
  if (gameEvent.status === 'finished') {
    const totalPoints1 = band1Points;
    const totalPoints2 = band2Points;
    const isDraw = totalPoints1 === totalPoints2;
    const winner = gameEvent.winner;
    
    // Após 5 segundos, mostra o leaderboard
    if (showLeaderboard) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 animate-gradient p-8 relative overflow-hidden">
          {/* Partículas de fundo - mais numerosas */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-20 left-10 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl animate-float"></div>
            <div className="absolute top-1/3 right-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
            <div className="absolute bottom-1/4 left-1/4 w-36 h-36 bg-indigo-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }}></div>
            <div className="absolute top-1/2 left-1/3 w-28 h-28 bg-pink-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
            <div className="absolute bottom-1/3 right-1/3 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }}></div>
            <div className="absolute top-10 right-1/4 w-24 h-24 bg-yellow-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '0.5s' }}></div>
          </div>

          {/* Estrelas decorativas ao redor */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <Star className="absolute top-10 left-20 h-6 w-6 text-yellow-400/30 animate-float" />
            <Star className="absolute top-1/4 right-10 h-8 w-8 text-purple-400/30 animate-float" style={{ animationDelay: '1.5s' }} />
            <Star className="absolute bottom-1/4 left-1/4 h-5 w-5 text-blue-400/30 animate-float" style={{ animationDelay: '2.5s' }} />
            <Star className="absolute bottom-10 right-1/3 h-7 w-7 text-pink-400/30 animate-float" style={{ animationDelay: '0.8s' }} />
            <Star className="absolute top-1/3 left-10 h-6 w-6 text-cyan-400/30 animate-float" style={{ animationDelay: '3.2s' }} />
          </div>

          <div className="max-w-7xl mx-auto relative z-10">
            {/* Header do Leaderboard */}
            <div className="text-center mb-10 animate-slide-top">
              {/* Coroa inclinada */}
              <div className="relative inline-block mb-4">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-28 h-28 bg-yellow-400 rounded-full blur-3xl opacity-40 animate-pulse-slow"></div>
                </div>
                <Crown className="h-16 w-16 mx-auto text-yellow-300 animate-float relative z-10" style={{
                  filter: 'drop-shadow(0 0 20px rgba(253, 224, 71, 0.9))',
                  transform: 'rotate(-15deg)'
                }} />
              </div>

              <h1
                className="text-5xl font-black text-white mb-4"
                style={{
                  textShadow: `
                    3px 3px 0px rgba(0, 0, 0, 0.3),
                    6px 6px 0px rgba(0, 0, 0, 0.2),
                    0 0 30px rgba(251, 191, 36, 0.4)
                  `
                }}
              >
                TOP VENCEDORES
              </h1>

              <div className="flex items-center justify-center gap-2 mb-3">
                <Star className="h-6 w-6 text-yellow-400 opacity-70" style={{ 
                  animation: 'float-gentle 4s ease-in-out infinite'
                }} />
                <p className="text-xl text-white/90 font-bold">Ranking por Vitórias</p>
                <Star className="h-6 w-6 text-yellow-400 opacity-70" style={{ 
                  animation: 'float-gentle 4s ease-in-out infinite',
                  animationDelay: '2s' 
                }} />
              </div>
            </div>

            {/* Pódio estilo Kahoot - Top 3 */}
            <div className="relative mb-12">
              <div className="flex items-end justify-center gap-6 px-4">
                {/* 2º Lugar - Esquerda */}
                {leaderboardData[1] && (
                  <div
                    className="flex flex-col items-center"
                    style={{
                      animation: 'slide-up-podium 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                      animationDelay: '0.2s',
                      opacity: 0
                    }}
                  >
                    {/* Avatar/Medalha */}
                    <div className="relative mb-4">
                      <div className="absolute inset-0 bg-gray-300 rounded-full blur-xl opacity-50 animate-pulse"></div>
                      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400 flex items-center justify-center border-4 border-gray-100 shadow-2xl">
                        <div className="text-5xl">🥈</div>
                      </div>
                    </div>

                    {/* Pilar */}
                    <div className="relative w-56">
                      {/* Glow do pilar */}
                      <div className="absolute inset-0 bg-gradient-to-t from-blue-400/40 to-transparent rounded-t-2xl blur-xl"></div>
                      
                      {/* Pilar principal */}
                      <div className="relative bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 rounded-t-3xl border-4 border-blue-300 shadow-2xl overflow-hidden"
                        style={{ height: '280px' }}>
                        {/* Brilho interno */}
                        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-white/20"></div>
                        
                        {/* Conteúdo */}
                        <div className="relative h-full flex flex-col items-center justify-between p-6">
                          {/* Nome */}
                          <div className="text-center">
                            <p className="text-2xl font-black text-white mb-1" style={{
                              textShadow: '0 2px 10px rgba(0,0,0,0.3)'
                            }}>
                              {leaderboardData[1].userName}
                            </p>
                          </div>

                          {/* Estatísticas */}
                          <div className="text-center space-y-2">
                            <div>
                              <p className="text-5xl font-black text-white tabular-nums" style={{
                                textShadow: '0 0 20px rgba(255, 255, 255, 0.5), 0 2px 10px rgba(0,0,0,0.3)'
                              }}>
                                {leaderboardData[1].victories}
                              </p>
                              <p className="text-sm text-white/90 uppercase font-bold tracking-wider">Vitórias</p>
                            </div>
                            <div className="pt-2 border-t-2 border-white/30">
                              <p className="text-2xl font-bold text-white">{leaderboardData[1].points}</p>
                              <p className="text-xs text-white/80 uppercase tracking-wider">Pontos</p>
                            </div>
                          </div>

                          {/* Número do rank */}
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                            <div className="text-7xl font-black text-white/20">#2</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 1º Lugar - Centro (mais alto) */}
                {leaderboardData[0] && (
                  <div
                    className="flex flex-col items-center"
                    style={{
                      animation: 'slide-up-podium 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                      animationDelay: '0s',
                      opacity: 0
                    }}
                  >
                    {/* Avatar/Medalha */}
                    <div className="relative mb-4">
                      {/* Raios de luz */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="absolute w-32 h-2 bg-gradient-to-r from-transparent via-yellow-300 to-transparent opacity-60 blur-sm"></div>
                        <div className="absolute w-2 h-32 bg-gradient-to-b from-transparent via-yellow-300 to-transparent opacity-60 blur-sm"></div>
                      </div>
                      <div className="absolute inset-0 bg-yellow-400 rounded-full blur-2xl opacity-60 animate-pulse-slow"></div>
                      <div className="relative w-28 h-28 rounded-full bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 flex items-center justify-center border-4 border-yellow-200 shadow-2xl">
                        <div className="text-6xl">🥇</div>
                      </div>
                    </div>

                    {/* Pilar */}
                    <div className="relative w-64">
                      {/* Glow do pilar */}
                      <div className="absolute inset-0 bg-gradient-to-t from-yellow-400/60 to-transparent rounded-t-2xl blur-2xl animate-neon-pulse"></div>
                      
                      {/* Pilar principal */}
                      <div className="relative bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 rounded-t-3xl border-4 border-yellow-300 shadow-2xl overflow-hidden"
                        style={{ height: '360px' }}>
                        {/* Brilho interno */}
                        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/20 to-white/30"></div>
                        
                        {/* Partículas de estrelas */}
                        <div className="absolute inset-0 overflow-hidden">
                          <Star className="absolute top-4 right-4 h-6 w-6 text-white/40 animate-float" />
                          <Star className="absolute top-12 left-6 h-4 w-4 text-white/30 animate-float" style={{ animationDelay: '1s' }} />
                          <Star className="absolute bottom-20 right-8 h-5 w-5 text-white/35 animate-float" style={{ animationDelay: '2s' }} />
                        </div>

                        {/* Conteúdo */}
                        <div className="relative h-full flex flex-col items-center justify-between p-6">
                          {/* Nome */}
                          <div className="text-center">
                            <p className="text-3xl font-black text-white mb-1" style={{
                              textShadow: '0 2px 15px rgba(0,0,0,0.4)'
                            }}>
                              {leaderboardData[0].userName}
                            </p>
                          </div>

                          {/* Estatísticas */}
                          <div className="text-center space-y-3">
                            <div>
                              <p className="text-7xl font-black text-white tabular-nums" style={{
                                textShadow: '0 0 30px rgba(255, 255, 255, 0.8), 0 2px 15px rgba(0,0,0,0.4)'
                              }}>
                                {leaderboardData[0].victories}
                              </p>
                              <p className="text-base text-white uppercase font-bold tracking-wider">Vitórias</p>
                            </div>
                            <div className="pt-3 border-t-2 border-white/40">
                              <p className="text-3xl font-bold text-white">{leaderboardData[0].points}</p>
                              <p className="text-sm text-white/90 uppercase tracking-wider">Pontos</p>
                            </div>
                          </div>

                          {/* Número do rank */}
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                            <div className="text-8xl font-black text-white/20">#1</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3º Lugar - Direita */}
                {leaderboardData[2] && (
                  <div
                    className="flex flex-col items-center"
                    style={{
                      animation: 'slide-up-podium 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                      animationDelay: '0.4s',
                      opacity: 0
                    }}
                  >
                    {/* Avatar/Medalha */}
                    <div className="relative mb-4">
                      <div className="absolute inset-0 bg-orange-400 rounded-full blur-xl opacity-50 animate-pulse"></div>
                      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-orange-300 via-orange-400 to-orange-600 flex items-center justify-center border-4 border-orange-200 shadow-2xl">
                        <div className="text-5xl">🥉</div>
                      </div>
                    </div>

                    {/* Pilar */}
                    <div className="relative w-56">
                      {/* Glow do pilar */}
                      <div className="absolute inset-0 bg-gradient-to-t from-red-400/40 to-transparent rounded-t-2xl blur-xl"></div>
                      
                      {/* Pilar principal */}
                      <div className="relative bg-gradient-to-br from-red-400 via-red-500 to-red-600 rounded-t-3xl border-4 border-red-300 shadow-2xl overflow-hidden"
                        style={{ height: '240px' }}>
                        {/* Brilho interno */}
                        <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-white/20"></div>
                        
                        {/* Conteúdo */}
                        <div className="relative h-full flex flex-col items-center justify-between p-6">
                          {/* Nome */}
                          <div className="text-center">
                            <p className="text-2xl font-black text-white mb-1" style={{
                              textShadow: '0 2px 10px rgba(0,0,0,0.3)'
                            }}>
                              {leaderboardData[2].userName}
                            </p>
                          </div>

                          {/* Estatísticas */}
                          <div className="text-center space-y-2">
                            <div>
                              <p className="text-4xl font-black text-white tabular-nums" style={{
                                textShadow: '0 0 20px rgba(255, 255, 255, 0.5), 0 2px 10px rgba(0,0,0,0.3)'
                              }}>
                                {leaderboardData[2].victories}
                              </p>
                              <p className="text-sm text-white/90 uppercase font-bold tracking-wider">Vitórias</p>
                            </div>
                            <div className="pt-2 border-t-2 border-white/30">
                              <p className="text-xl font-bold text-white">{leaderboardData[2].points}</p>
                              <p className="text-xs text-white/80 uppercase tracking-wider">Pontos</p>
                            </div>
                          </div>

                          {/* Número do rank */}
                          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                            <div className="text-7xl font-black text-white/20">#3</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Lista dos demais (4º em diante) */}
            {leaderboardData.length > 3 && (
              <div className="space-y-4 max-w-4xl mx-auto">
                <div className="text-center mb-4">
                  <div className="inline-block px-6 py-2 bg-white/10 rounded-full backdrop-blur-sm border border-white/20">
                    <p className="text-lg font-bold text-white/90">Outros Competidores</p>
                  </div>
                </div>
                
                {leaderboardData.slice(3).map((entry, index) => {
                  const actualIndex = index + 3;
                  return (
                    <div
                      key={entry.userId}
                      className="relative group"
                      style={{
                        animation: 'slide-from-left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                        animationDelay: `${0.6 + index * 0.1}s`,
                        opacity: 0
                      }}
                    >
                      {/* Card principal */}
                      <div className="relative flex items-center gap-4 p-4 rounded-2xl bg-white/5 backdrop-blur-sm border-2 border-white/20 hover:bg-white/10 hover:scale-[1.02] transition-all duration-300 shadow-lg">
                        {/* Número da posição */}
                        <div className="flex-shrink-0 w-14 h-14 flex items-center justify-center">
                          <div
                            className="text-2xl font-black text-white/70"
                            style={{
                              textShadow: '0 0 8px rgba(255, 255, 255, 0.3)'
                            }}
                          >
                            #{entry.rank}
                          </div>
                        </div>

                        {/* Nome do usuário */}
                        <div className="flex-1">
                          <p
                            className="text-xl font-black text-white"
                            style={{
                              textShadow: '0 0 8px rgba(255, 255, 255, 0.3)'
                            }}
                          >
                            {entry.userName}
                          </p>
                        </div>

                        {/* Estatísticas */}
                        <div className="flex gap-6 items-center">
                          {/* Vitórias */}
                          <div className="text-right">
                            <p
                              className="text-2xl font-black text-white tabular-nums"
                              style={{
                                textShadow: '0 0 8px rgba(255, 255, 255, 0.3)'
                              }}
                            >
                              {entry.victories}
                            </p>
                            <p className="text-xs text-white/60 uppercase font-bold tracking-wider mt-1">
                              Vitórias
                            </p>
                          </div>

                          {/* Pontos */}
                          <div className="text-right opacity-70">
                            <p className="text-lg font-bold text-white">
                              {entry.points}
                            </p>
                            <p className="text-xs text-white/60 uppercase tracking-wider mt-1">Pontos</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <div className="text-center mt-8 animate-fade-in" style={{ animationDelay: '1s' }}>
              <p className="text-lg text-white/60">
                Continue jogando para subir no ranking! 🚀
              </p>
            </div>
          </div>
        </div>
      );
    }
    
    // Primeiros 8 segundos: Tela de resultado
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 animate-gradient flex flex-col items-center justify-center p-8 relative overflow-hidden">
        {/* Confete caindo (apenas para vencedor, não empate) */}
        {!isDraw && (
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="absolute w-3 h-3 rounded-full animate-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-${Math.random() * 20}px`,
                  backgroundColor: ['#fbbf24', '#f59e0b', '#fb923c', '#f472b6', '#c084fc'][Math.floor(Math.random() * 5)],
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${3 + Math.random() * 2}s`
                }}
              />
            ))}
          </div>
        )}

        <div className="text-center text-white space-y-12 animate-fade-in relative z-10">
          {isDraw ? (
            <>
              {/* Empate com efeito holográfico */}
              <h1
                className="text-[10rem] font-black tracking-tight animate-holographic"
                style={{
                  textShadow: `
                    0 0 40px rgba(236, 72, 153, 0.8),
                    0 0 80px rgba(168, 85, 247, 0.6),
                    0 0 120px rgba(59, 130, 246, 0.4)
                  `
                }}
              >
                EMPATE!
              </h1>
              <p className="text-6xl font-bold opacity-90 animate-pulse-slow">
                Ambos jogadores foram incríveis! 
              </p>
            </>
          ) : (
            <>
              {/* Troféu com rotação 3D e raios de luz */}
              <div className="relative inline-block">
                {/* Glow dourado pulsante */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 bg-yellow-400 rounded-full blur-3xl opacity-40 animate-pulse-slow"></div>
                </div>

                {/* Troféu principal */}
                <Trophy className="h-32 w-32 mx-auto text-yellow-400 animate-rotate-3d relative z-10" style={{
                  filter: 'drop-shadow(0 0 30px rgba(251, 191, 36, 0.8)) drop-shadow(0 0 60px rgba(251, 191, 36, 0.5))'
                }} />
              </div>

              <h1
                className="text-6xl font-black tracking-tight animate-slide-top"
                style={{
                  textShadow: `
                    4px 4px 0px rgba(0, 0, 0, 0.3),
                    8px 8px 0px rgba(0, 0, 0, 0.2),
                    0 0 40px rgba(251, 191, 36, 0.6)
                  `
                }}
              >
                FIM DE JOGO!
              </h1>
            </>
          )}

          <div className="grid grid-cols-2 gap-8 mt-8 max-w-5xl mx-auto">
            {/* Band 1 */}
            <div className={`relative rounded-2xl p-6 border-4 transition-all duration-700 ${
              winner === 'band010'
                ? 'scale-105 animate-victory'
                : winner === 'band020'
                ? 'scale-95 opacity-60 grayscale-[30%]'
                : ''
            }`}>
              {/* Vencedor: efeito dourado */}
              {winner === 'band010' && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 rounded-2xl blur-xl opacity-50"></div>
                  <div className="absolute inset-0 border-4 border-yellow-400 rounded-2xl animate-neon-pulse"></div>
                </>
              )}

              {/* Card principal */}
              <div className={`relative glass-morphism-strong rounded-2xl p-6 border-3 ${
                winner === 'band010' ? 'border-yellow-400' : 'border-blue-300/40'
              } shadow-2xl`}>
                <div className="space-y-4">
                  <div className="text-2xl font-black tracking-wide">PULSEIRA {band1Id}</div>

                  <div
                    className="text-[5rem] font-black tabular-nums text-white"
                    style={{
                      textShadow: winner === 'band010'
                        ? '0 0 30px rgba(251, 191, 36, 0.8), 0 0 60px rgba(251, 191, 36, 0.5), 3px 3px 0px rgba(0, 0, 0, 0.3)'
                        : '0 0 15px rgba(59, 130, 246, 0.5), 3px 3px 0px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    {totalPoints1}
                  </div>

                  <div className="space-y-1">
                    <div className="text-xl font-bold">{band1?.userName}</div>
                    <div className="text-sm opacity-80">{band1?.userEmail}</div>
                  </div>

                  {winner === 'band010' && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <Crown className="h-10 w-10 text-yellow-400 animate-bounce" />
                      <div className="text-3xl font-black text-yellow-400 animate-pulse-slow">
                        VENCEDOR!
                      </div>
                      <Crown className="h-10 w-10 text-yellow-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Band 2 */}
            <div className={`relative rounded-2xl p-6 border-4 transition-all duration-700 ${
              winner === 'band020'
                ? 'scale-105 animate-victory'
                : winner === 'band010'
                ? 'scale-95 opacity-60 grayscale-[30%]'
                : ''
            }`}>
              {/* Vencedor: efeito dourado */}
              {winner === 'band020' && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-400 via-amber-500 to-orange-500 rounded-2xl blur-xl opacity-50"></div>
                  <div className="absolute inset-0 border-4 border-yellow-400 rounded-2xl animate-neon-pulse"></div>
                </>
              )}

              {/* Card principal */}
              <div className={`relative glass-morphism-strong rounded-2xl p-6 border-3 ${
                winner === 'band020' ? 'border-yellow-400' : 'border-red-300/40'
              } shadow-2xl`}>
                <div className="space-y-4">
                  <div className="text-2xl font-black tracking-wide">PULSEIRA {band2Id}</div>

                  <div
                    className="text-[5rem] font-black tabular-nums text-white"
                    style={{
                      textShadow: winner === 'band020'
                        ? '0 0 30px rgba(251, 191, 36, 0.8), 0 0 60px rgba(251, 191, 36, 0.5), 3px 3px 0px rgba(0, 0, 0, 0.3)'
                        : '0 0 15px rgba(239, 68, 68, 0.5), 3px 3px 0px rgba(0, 0, 0, 0.3)'
                    }}
                  >
                    {totalPoints2}
                  </div>

                  <div className="space-y-1">
                    <div className="text-xl font-bold">{band2?.userName}</div>
                    <div className="text-sm opacity-80">{band2?.userEmail}</div>
                  </div>

                  {winner === 'band020' && (
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <Crown className="h-10 w-10 text-yellow-400 animate-bounce" />
                      <div className="text-3xl font-black text-yellow-400 animate-pulse-slow">
                        VENCEDOR!
                      </div>
                      <Crown className="h-10 w-10 text-yellow-400 animate-bounce" style={{ animationDelay: '0.2s' }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 space-y-4 animate-fade-in" style={{ animationDelay: '0.5s' }}>
            <p className="text-4xl font-black" style={{
              textShadow: '0 0 25px rgba(255, 255, 255, 0.5)'
            }}>
              Parabéns aos participantes! 🎉
            </p>
            <p className="text-2xl opacity-80 animate-pulse">
              Aguarde o ranking geral...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
