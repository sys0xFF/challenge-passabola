'use client';

import { useEffect, useState } from 'react';
import { useNext2025Auth } from '@/contexts/next2025-auth-context';
import { 
  Next2025Header,
  Next2025Card,
  Next2025Button,
  Next2025ListItem,
  Next2025EmptyState,
  Next2025Loading
} from '@/components/next2025/shared';
import { 
  linkBandToNext2025User,
  unlinkBandFromNext2025User,
  getUserBands as getNext2025UserBands
} from '@/lib/next2025-service';
import { 
  getBandDevices,
  extractBandId,
  formatBandId 
} from '@/lib/band-service';
import { BandLink } from '@/lib/band-service';
import { Link as LinkIcon, Unlink, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function VincularPulseiraPage() {
  const { user, refreshUser } = useNext2025Auth();
  const [linkedBands, setLinkedBands] = useState<BandLink[]>([]);
  const [availableBands, setAvailableBands] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Buscar pulseiras vinculadas ao usuário
      const userBands = await getNext2025UserBands(user.id);
      setLinkedBands(userBands);

      // Buscar todas as pulseiras disponíveis
      const devicesResponse = await getBandDevices();
      const allBandIds = devicesResponse.devices.map(device => 
        extractBandId(device.entity_name)
      ).filter(Boolean);

      // Filtrar pulseiras que não estão vinculadas
      const linkedBandIds = userBands.map(b => b.bandId);
      const available = allBandIds.filter(id => !linkedBandIds.includes(id));
      setAvailableBands(available);

    } catch (error) {
      console.error('Error loading bands:', error);
      toast.error('Erro ao carregar pulseiras');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkBand = async (bandId: string) => {
    if (!user) return;

    // Mostra aviso que vinculação só é possível via NFC no evento
    toast.info(
      'A vinculação de pulseiras só é possível durante o evento, através do nosso PIN NFC. Procure nossa equipe para vincular sua pulseira!',
      { duration: 5000 }
    );
    return;

    /* Lógica de vinculação manual comentada - só é permitida via NFC no evento
    setActionLoading(bandId);
    try {
      const result = await linkBandToNext2025User(bandId, user.id);

      if (result.success) {
        toast.success(`Pulseira ${bandId} vinculada com sucesso!`);
        await refreshUser();
        await loadData();
      } else {
        toast.error(result.error || 'Erro ao vincular pulseira');
      }
    } catch (error) {
      console.error('Error linking band:', error);
      toast.error('Erro ao vincular pulseira');
    } finally {
      setActionLoading(null);
    }
    */
  };

  const handleUnlinkBand = async (bandId: string) => {
    if (!user) return;

    if (!confirm(`Deseja realmente desvincular a pulseira ${bandId}?`)) {
      return;
    }

    setActionLoading(bandId);
    try {
      const result = await unlinkBandFromNext2025User(bandId, user.id);

      if (result.success) {
        toast.success(`Pulseira ${bandId} desvinculada com sucesso!`);
        await refreshUser();
        await loadData();
      } else {
        toast.error(result.error || 'Erro ao desvincular pulseira');
      }
    } catch (error) {
      console.error('Error unlinking band:', error);
      toast.error('Erro ao desvincular pulseira');
    } finally {
      setActionLoading(null);
    }
  };

  if (!user) return null;

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl space-y-6">
      {/* Header */}
      <Next2025Header>
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-blue-500/10 p-2">
            <LinkIcon className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Pulseiras IoT</h1>
            <p className="text-sm text-muted-foreground">
              {linkedBands.length} vinculada{linkedBands.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </Next2025Header>

      {loading ? (
        <Next2025Loading message="Carregando pulseiras..." />
      ) : (
        <>
          {/* Pulseiras Vinculadas */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Minhas Pulseiras
            </h3>
            
            {linkedBands.length > 0 ? (
              <div className="space-y-2">
                {linkedBands.map((band) => (
                  <Next2025Card key={band.bandId} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex-shrink-0 rounded-full bg-emerald-500/10 p-2">
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{formatBandId(band.bandId)}</p>
                          <p className="text-sm text-muted-foreground">
                            Vinculada em {new Date(band.linkedAt).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <Next2025Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnlinkBand(band.bandId)}
                        disabled={actionLoading === band.bandId}
                        className="flex-shrink-0"
                      >
                        {actionLoading === band.bandId ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Unlink className="h-4 w-4" />
                        )}
                      </Next2025Button>
                    </div>
                  </Next2025Card>
                ))}
              </div>
            ) : (
              <Next2025EmptyState
                icon={<LinkIcon className="h-8 w-8" />}
                title="Nenhuma pulseira vinculada"
                description="Vincule uma pulseira IoT para começar a ganhar pontos nos eventos"
              />
            )}
          </div>

          {/* Pulseiras Disponíveis - Vinculação apenas via NFC */}
          {availableBands.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-blue-500" />
                Pulseiras Disponíveis
              </h3>
              
              <div className="space-y-2">
                {availableBands.map((bandId) => (
                  <Next2025Card key={bandId} className="p-4 opacity-60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="flex-shrink-0 rounded-full bg-blue-500/10 p-2">
                          <LinkIcon className="h-5 w-5 text-blue-500" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{formatBandId(bandId)}</p>
                          <p className="text-sm text-muted-foreground">
                            Vincule via NFC no evento
                          </p>
                        </div>
                      </div>
                      <Next2025Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleLinkBand(bandId)}
                        disabled={actionLoading === bandId}
                        className="flex-shrink-0"
                      >
                        {actionLoading === bandId ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Vinculando...
                          </>
                        ) : (
                          'Vincular'
                        )}
                      </Next2025Button>
                    </div>
                  </Next2025Card>
                ))}
              </div>
            </div>
          )}

          {/* Info Card */}
          <Next2025Card className="p-4 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <p className="font-medium mb-2">Como vincular sua pulseira?</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                  <li>Procure nossa equipe no evento</li>
                  <li>Aproxime seu celular do nosso PIN NFC</li>
                  <li>A pulseira será vinculada automaticamente</li>
                  <li>Participe dos jogos e ganhe pontos!</li>
                  <li>Troque seus pontos por recompensas exclusivas</li>
                </ul>
                <p className="mt-3 font-medium text-amber-700 dark:text-amber-300">
                  ⚠️ A vinculação só é possível presencialmente durante o evento através do nosso PIN NFC.
                </p>
              </div>
            </div>
          </Next2025Card>
        </>
      )}
    </div>
  );
}
