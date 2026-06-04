'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-shim';
import { useNavigate } from '@/lib/router-shim';
import {
  Loader2,
  LogOut,
  Users,
  Calendar,
  GitCompare,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Shield,
  UserPlus,
  AlertTriangle,
  Sparkles,
  Copy,
  Check,
  TrendingUp,
  Download,
  Globe,
  CheckSquare,
  Square,
  RefreshCw,
  Zap,
  Clock,
  PlayCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── League Groups for 365Scores Import ───────────────────────────────────────

const GROUPS_365: { label: string; flag: string; keys: string[] }[] = [
  {
    label: 'Brasil',
    flag: '🇧🇷',
    keys: [
      'brasileirao_a',
      'brasileirao_b',
      'copa_do_brasil',
      'paulistao',
      'mineiro',
      'gaucho',
      'baiano',
      'carioca',
    ],
  },
  {
    label: 'América do Sul',
    flag: '🌎',
    keys: [
      'libertadores',
      'sudamericana',
      'argentina',
      'argentina_2',
      'colombia_liga',
      'chile_primera',
      'peru_liga',
      'ecuador_liga',
      'uruguay_primeira',
      'venezuela_primera',
      'bolivia_liga',
      'paraguay_primeira',
    ],
  },
  {
    label: 'América do Norte',
    flag: '🌎',
    keys: ['mls', 'liga_mx', 'liga_mx_expansion', 'concacaf_champions'],
  },
  {
    label: 'Inglaterra',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    keys: ['premier_league', 'championship', 'league_one', 'league_two', 'national_league'],
  },
  { label: 'Espanha', flag: '🇪🇸', keys: ['la_liga', 'segunda_division'] },
  { label: 'Itália', flag: '🇮🇹', keys: ['serie_a', 'serie_b_italy'] },
  { label: 'Alemanha', flag: '🇩🇪', keys: ['bundesliga', 'bundesliga_2', 'liga_3'] },
  { label: 'França', flag: '🇫🇷', keys: ['ligue_1', 'ligue_2'] },
  { label: 'Portugal', flag: '🇵🇹', keys: ['primeira_liga', 'liga_portugal_2'] },
  {
    label: 'Escócia',
    flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    keys: ['scottish_prem', 'scottish_champ', 'scottish_league_one', 'scottish_league_two'],
  },
  {
    label: 'Outras Ligas Europeias',
    flag: '🇪🇺',
    keys: [
      'eredivisie',
      'belgian_pro',
      'austrian_bl',
      'swiss_super',
      'turkish_super',
      'greek_super',
      'russian_premier',
      'ukrainian_premier',
      'danish_super',
      'swedish_allsvenskan',
      'norwegian_eliteserien',
      'polish_ekstraklasa',
      'romanian_superliga',
      'czech_first',
      'croatian_hnl',
      'serbian_superliga',
      'hungarian_otp',
      'bulgarian_first',
      'slovenian_liga',
      'slovak_super',
      'israeli_premier',
      'irish_loi',
      'finnish_veikkaus',
      'azerbaijani_premier',
      'kazakh_premier',
    ],
  },
  {
    label: 'UEFA',
    flag: '⭐',
    keys: ['champions_league', 'europa_league', 'conference_league', 'nations_league'],
  },
  {
    label: 'Ásia / Oceania',
    flag: '🌏',
    keys: [
      'j1_league',
      'j2_league',
      'k_league_1',
      'k_league_2',
      'china_csl',
      'saudi_pro',
      'uae_pro',
      'indian_isl',
      'thai_league',
      'a_league',
      'afc_champions',
    ],
  },
  {
    label: 'África',
    flag: '🌍',
    keys: ['egypt_premier', 'moroccan_botola', 'south_africa_psl', 'caf_champions'],
  },
];

const GROUPS_SPORTSDB: { label: string; flag: string; keys: string[] }[] = [
  { label: 'Brasil', flag: '🇧🇷', keys: ['brasileirao_a', 'brasileirao_b', 'copa_do_brasil'] },
  { label: 'América do Sul', flag: '🌎', keys: ['libertadores', 'argentina_primeira'] },
  { label: 'América do Norte', flag: '🌎', keys: ['mls', 'liga_mx'] },
  {
    label: 'Top 5 Europa',
    flag: '🏆',
    keys: ['premier_league', 'la_liga', 'serie_a', 'bundesliga', 'ligue_1'],
  },
  {
    label: 'Outras Ligas Europeias',
    flag: '🇪🇺',
    keys: [
      'eredivisie',
      'primeira_liga',
      'scottish_prem',
      'belgian_pro',
      'swiss_super',
      'danish_super',
      'turkish_super',
      'russian_premier',
      'croatian_hnl',
    ],
  },
  { label: 'UEFA', flag: '⭐', keys: ['champions_league', 'europa_league'] },
  { label: 'Ásia', flag: '🌏', keys: ['j1_league', 'saudi_pro'] },
];

// ── League labels for pending match editing ───────────────────────────────────

const ALL_LEAGUE_OPTIONS: { key: string; label: string }[] = [
  { key: 'brasileirao_a', label: '🇧🇷 Brasileirão Série A' },
  { key: 'brasileirao_b', label: '🇧🇷 Brasileirão Série B' },
  { key: 'copa_do_brasil', label: '🏆 Copa do Brasil' },
  { key: 'paulistao', label: '🇧🇷 Paulistão' },
  { key: 'mineiro', label: '🇧🇷 Mineiro' },
  { key: 'gaucho', label: '🇧🇷 Gaúcho' },
  { key: 'baiano', label: '🇧🇷 Baiano' },
  { key: 'carioca', label: '🇧🇷 Carioca' },
  { key: 'libertadores', label: '🌎 Copa Libertadores' },
  { key: 'sudamericana', label: '🌎 Copa Sul-Americana' },
  { key: 'argentina', label: '🇦🇷 Liga Profesional' },
  { key: 'colombia_liga', label: '🇨🇴 Liga BetPlay' },
  { key: 'chile_primera', label: '🇨🇱 Primera División Chile' },
  { key: 'ecuador_liga', label: '🇪🇨 Liga Pro Equador' },
  { key: 'uruguay_primera', label: '🇺🇾 Primera Uruguay' },
  { key: 'venezuela_primera', label: '🇻🇪 Primera Venezuela' },
  { key: 'paraguay_primera', label: '🇵🇾 División Paraguai' },
  { key: 'mls', label: '🇺🇸 MLS' },
  { key: 'liga_mx', label: '🇲🇽 Liga MX' },
  { key: 'premier_league', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League' },
  { key: 'championship', label: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship' },
  { key: 'la_liga', label: '🇪🇸 La Liga' },
  { key: 'serie_a', label: '🇮🇹 Serie A' },
  { key: 'bundesliga', label: '🇩🇪 Bundesliga' },
  { key: 'ligue_1', label: '🇫🇷 Ligue 1' },
  { key: 'eredivisie', label: '🇳🇱 Eredivisie' },
  { key: 'primeira_liga', label: '🇵🇹 Primeira Liga' },
  { key: 'champions_league', label: '⭐ Champions League' },
  { key: 'europa_league', label: '⭐ Europa League' },
  { key: 'j1_league', label: '🇯🇵 J1 League' },
  { key: 'saudi_pro', label: '🇸🇦 Saudi Pro League' },
  { key: 'egypt_premier', label: '🇪🇬 Egyptian Premier' },
  { key: 'south_africa_psl', label: '🇿🇦 DStv Premiership' },
  { key: 'other', label: '🌐 Outra / Desconhecida' },
];

// ─────────────────────────────────────────────────────────────────────────────

interface Team {
  id: number;
  name: string;
  short_name: string;
  league: string;
}

interface TeamStats {
  id: number;
  team_id: number;
  team_name?: string;
  season: string;
  games_played: number;
  avg_corners: number;
  home_avg: number;
  away_avg: number;
  over_85_pct: number;
  over_95_pct: number;
  over_105_pct: number;
  over_115_pct: number;
  home_games: number;
  away_games: number;
  games_winning: number;
  games_drawing: number;
  games_losing: number;
  corners_when_winning: number;
  corners_when_drawing: number;
  corners_when_losing: number;
  last_5_avg: number;
  recent_matches: string;
}

interface Match {
  id: number;
  home_team: string;
  away_team: string;
  match_date: string;
  match_time: string;
  league: string;
  round: string;
  referee: string;
  home_corners: number | null;
  away_corners: number | null;
  is_completed: number;
}

interface Admin {
  id: number;
  user_id: string;
  email: string;
  is_active: number;
  created_at: string;
}

interface FaqItem {
  question: string;
  asked_count: number;
}

interface ImportMatch {
  home_team: string;
  away_team: string;
  match_date: string;
  match_time: string | null;
  league: string;
  round: string | null;
  referee: string | null;
}

interface ImportConflict {
  league: string;
  leagueName: string;
  sources: Array<{ name: string; count: number; sample: string[] }>;
  matches365: ImportMatch[];
  matchesSportsDB: ImportMatch[];
}

// ── Automation League Groups ──────────────────────────────────────────────────

const AUTOMATION_LEAGUE_GROUPS: { label: string; flag: string; keys: string[] }[] = [
  { label: 'Brasil', flag: '🇧🇷', keys: ['brasileirao_a', 'brasileirao_b', 'copa_do_brasil'] },
  {
    label: 'CONMEBOL',
    flag: '🌎',
    keys: [
      'libertadores',
      'sudamericana',
      'argentina',
      'chile_primera',
      'colombia_liga',
      'ecuador_liga',
      'peru_liga',
      'uruguay_primera',
    ],
  },
  { label: 'América do Norte', flag: '🌎', keys: ['mls', 'liga_mx'] },
  {
    label: 'Top 5 Europa',
    flag: '🏆',
    keys: ['premier_league', 'la_liga', 'serie_a', 'bundesliga', 'ligue_1'],
  },
  { label: 'UEFA', flag: '⭐', keys: ['champions_league', 'europa_league', 'conference_league'] },
  {
    label: 'Outras Europeias',
    flag: '🇪🇺',
    keys: [
      'eredivisie',
      'primeira_liga',
      'championship',
      'scottish_prem',
      'belgian_pro',
      'turkish_super',
      'greek_super',
      'russian_premier',
      'danish_super',
      'swedish_allsvenskan',
      'norwegian_eliteserien',
      'swiss_super',
    ],
  },
  { label: 'Ásia', flag: '🌏', keys: ['j1_league', 'k_league_1', 'saudi_pro'] },
];

const DEFAULT_AUTO_LEAGUES = [
  'brasileirao_a',
  'brasileirao_b',
  'copa_do_brasil',
  'libertadores',
  'sudamericana',
  'argentina',
  'mls',
  'liga_mx',
  'premier_league',
  'la_liga',
  'serie_a',
  'bundesliga',
  'ligue_1',
  'champions_league',
  'europa_league',
  'conference_league',
];

interface SyncResult {
  success: boolean;
  duration?: string;
  import?: {
    total: number;
    results: Array<{
      league: string;
      name: string;
      inserted: number;
      skipped: number;
      error?: string;
    }>;
  };
  fill?: {
    filled: number;
    notFound: number;
    errors: number;
    details: Array<{
      id: number;
      match: string;
      status: string;
      homeCorners?: number;
      awayCorners?: number;
      note?: string;
    }>;
  };
}

// NEW: suggestion type
interface LeagueSuggestion {
  key: string;
  name: string;
  country: string;
  score: number;
  reason: string;
}

type TabType = string;

// ── AutomacaoTab Component ───────────────────────────────────────────────────

function AutomacaoTab() {
  const [selectedLeagues, setSelectedLeagues] = useState<Set<string>>(
    new Set(DEFAULT_AUTO_LEAGUES)
  );
  const [syncing, setSyncing] = useState(false);
  const [task, setTask] = useState<'import' | 'fill' | 'all'>('all');
  const [fillLimit, setFillLimit] = useState(50);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const allKeys = AUTOMATION_LEAGUE_GROUPS.flatMap((g) => g.keys);

  const toggleLeague = (key: string) => {
    setSelectedLeagues((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroup = (keys: string[]) => {
    const allSel = keys.every((k) => selectedLeagues.has(k));
    setSelectedLeagues((prev) => {
      const next = new Set(prev);
      if (allSel) keys.forEach((k) => next.delete(k));
      else keys.forEach((k) => next.add(k));
      return next;
    });
  };

  const handleSync = async () => {
    setSyncing(true);
    setResult(null);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          leagues: task !== 'fill' ? Array.from(selectedLeagues) : undefined,
          limit: fillLimit,
        }),
      });
      const data = (await res.json()) as SyncResult;
      setResult(data);
      if (data.success) {
        const importMsg = data.import ? `${data.import.total} jogos importados` : '';
        const fillMsg = data.fill ? `${data.fill.filled} escanteios preenchidos` : '';
        const parts = [importMsg, fillMsg].filter(Boolean);
        setMessage({ type: 'success', text: `✅ ${parts.join(' · ')} (${data.duration})` });
      } else {
        setMessage({ type: 'error', text: 'Erro durante a sincronização' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Erro de rede' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Automação — Importar Jogos e Preencher Escanteios
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Busca os próximos jogos e os resultados com escanteios diretamente do Sofascore.
          </p>
        </div>
        <Button
          onClick={handleSync}
          disabled={syncing || (task !== 'fill' && selectedLeagues.size === 0)}
          className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold px-6 shrink-0"
        >
          {syncing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2" style={{ animation: 'spin 1s linear infinite' }} />
              Sincronizando...
            </>
          ) : (
            <>
              <PlayCircle className="w-4 h-4 mr-2" />
              Executar Agora
            </>
          )}
        </Button>
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}
        >
          {message.text}
        </div>
      )}

      {/* Task selector */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
        <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Tarefa</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              key: 'all' as const,
              icon: '🔄',
              label: 'Tudo',
              sub: 'Importar + preencher escanteios',
            },
            {
              key: 'import' as const,
              icon: '📥',
              label: 'Só Importar',
              sub: 'Busca próximos jogos das ligas',
            },
            {
              key: 'fill' as const,
              icon: '⚽',
              label: 'Só Preencher',
              sub: 'Preenche escanteios de jogos passados',
            },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTask(t.key)}
              className={`text-left px-4 py-3 rounded-lg border-2 transition ${task === t.key ? 'border-yellow-500 bg-yellow-500/10' : 'border-slate-600 bg-slate-800 hover:border-slate-500'}`}
            >
              <span className="text-lg">{t.icon}</span>
              <p
                className={`font-semibold text-sm mt-1 ${task === t.key ? 'text-yellow-300' : 'text-white'}`}
              >
                {t.label}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{t.sub}</p>
            </button>
          ))}
        </div>

        {(task === 'fill' || task === 'all') && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-700/50">
            <label className="text-xs text-slate-400 shrink-0">
              Máx. partidas pendentes para preencher:
            </label>
            <select
              value={fillLimit}
              onChange={(e) => setFillLimit(Number(e.target.value))}
              className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-sm"
            >
              {[10, 25, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} partidas
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* League selector — only shown for import tasks */}
      {task !== 'fill' && (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedLeagues(new Set(allKeys))}
              className="flex items-center gap-1.5 text-sm text-yellow-400 hover:text-yellow-300"
            >
              <CheckSquare className="w-4 h-4" />
              Todas
            </button>
            <button
              onClick={() => setSelectedLeagues(new Set(DEFAULT_AUTO_LEAGUES))}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-300"
            >
              <RefreshCw className="w-4 h-4" />
              Padrão
            </button>
            <button
              onClick={() => setSelectedLeagues(new Set())}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-400"
            >
              <Square className="w-4 h-4" />
              Limpar
            </button>
            <span className="ml-auto text-sm text-slate-500">{selectedLeagues.size} ligas</span>
          </div>

          {AUTOMATION_LEAGUE_GROUPS.map((group) => {
            const allSel = group.keys.every((k) => selectedLeagues.has(k));
            const someSel = group.keys.some((k) => selectedLeagues.has(k));
            return (
              <div
                key={group.label}
                className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => toggleGroup(group.keys)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-700/40 hover:bg-slate-700/60 transition"
                >
                  <div className="flex items-center gap-2">
                    <span>{group.flag}</span>
                    <span className="text-white font-medium text-sm">{group.label}</span>
                    <span className="text-xs text-slate-500">({group.keys.length})</span>
                  </div>
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center ${allSel ? 'bg-yellow-500 border-yellow-500' : someSel ? 'bg-yellow-500/30 border-yellow-500' : 'border-slate-500'}`}
                  >
                    {(allSel || someSel) && <Check className="w-2.5 h-2.5 text-black" />}
                  </div>
                </button>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {group.keys.map((key) => {
                    const isSel = selectedLeagues.has(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleLeague(key)}
                        className={`flex items-center gap-2 px-3 py-2 text-left transition border-b border-slate-700/30 hover:bg-slate-700/30 text-xs ${isSel ? 'bg-yellow-500/5' : ''}`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center ${isSel ? 'bg-yellow-500 border-yellow-500' : 'border-slate-500'}`}
                        >
                          {isSel && <Check className="w-2 h-2 text-black" />}
                        </div>
                        <span className={isSel ? 'text-yellow-200' : 'text-slate-300'}>
                          {key.replace(/_/g, ' ')}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {result.import && (
            <div className="bg-slate-800/50 border border-emerald-500/30 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-400" />
                Importação — {result.import.total} novos jogos
              </h3>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {result.import.results
                  .filter((r) => r.inserted > 0 || r.error)
                  .map((r, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between px-3 py-1.5 rounded text-xs ${r.error ? 'bg-red-500/10 text-red-400' : 'bg-slate-700/30 text-slate-300'}`}
                    >
                      <span>{r.name}</span>
                      <span>
                        {r.error ? `❌ ${r.error}` : `+${r.inserted} | skip:${r.skipped}`}
                      </span>
                    </div>
                  ))}
                {result.import.results.every((r) => r.inserted === 0 && !r.error) && (
                  <p className="text-slate-400 text-xs text-center py-2">
                    Todos os jogos já estavam na base.
                  </p>
                )}
              </div>
            </div>
          )}

          {result.fill && (
            <div className="bg-slate-800/50 border border-blue-500/30 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-blue-400" />
                Preenchimento de Escanteios
              </h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-emerald-400">{result.fill.filled}</p>
                  <p className="text-xs text-slate-400 mt-1">Preenchidos</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-amber-400">{result.fill.notFound}</p>
                  <p className="text-xs text-slate-400 mt-1">Não encontrados</p>
                </div>
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-red-400">{result.fill.errors}</p>
                  <p className="text-xs text-slate-400 mt-1">Erros</p>
                </div>
              </div>
              {result.fill.details.length > 0 && (
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  {result.fill.details.map((d, i) => (
                    <div
                      key={i}
                      className={`flex items-start justify-between px-3 py-1.5 rounded text-xs gap-2 ${d.status === 'filled' ? 'bg-emerald-500/10 text-emerald-300' : d.status === 'error' ? 'bg-red-500/10 text-red-300' : 'bg-slate-700/40 text-slate-400'}`}
                    >
                      <span className="truncate flex-1">{d.match}</span>
                      <span className="shrink-0">
                        {d.status === 'filled'
                          ? `✅ ${d.homeCorners}-${d.awayCorners}`
                          : d.status === 'error'
                            ? `❌ ${d.note ?? 'erro'}`
                            : `⚠️ ${d.note ?? 'não encontrado'}`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Cron setup info */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-2">
          <Clock className="w-3.5 h-3.5" />
          Atualização Automática (Cron)
        </p>
        <p className="text-xs text-slate-400">
          Configure um cron job em{' '}
          <a
            href="https://cron-job.org"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            cron-job.org
          </a>{' '}
          (gratuito) para executar diariamente:
        </p>
        <div className="bg-slate-900 rounded-lg px-3 py-2 font-mono text-xs text-emerald-400 break-all select-all">
          {typeof window !== 'undefined' ? window.location.origin : 'https://seu-app.com'}
          /api/cron/daily-update?secret=SUA_CRON_SECRET
        </div>
        <p className="text-xs text-slate-500">
          Certifique-se que a variável <code className="text-amber-400">CRON_SECRET</code> está
          configurada nas Configurações do projeto.
        </p>
      </div>

      {/* Cleanup tools */}
      <CleanupCard
        onDone={() =>
          setMessage({
            type: 'success',
            text: '✅ Limpeza concluída! Recarregue a página para atualizar as pendências.',
          })
        }
      />
    </div>
  );
}

// ── CleanupCard Component ────────────────────────────────────────────────────
function CleanupCard({ onDone }: { onDone: () => void }) {
  const [cleaning, setCleaning] = useState<string | null>(null);

  const cleanup = async (mode: 'wrong_league' | 'old' | 'all_pending') => {
    if (
      !confirm(
        mode === 'all_pending'
          ? 'Isso vai apagar TODAS as pendências sem escanteios. Tem certeza?'
          : mode === 'wrong_league'
            ? 'Remover jogos claramente fora da liga correta (ex: MLS no Brasileirão)?'
            : 'Remover pendências com mais de 60 dias?'
      )
    )
      return;
    setCleaning(mode);
    try {
      const res = await fetch('/api/admin/matches/pending', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, cutoffDays: 60 }),
      });
      const data = (await res.json()) as { deleted: number; message: string };
      onDone();
      alert(data.message);
    } catch {
      alert('Erro ao limpar');
    } finally {
      setCleaning(null);
    }
  };

  return (
    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-red-400 uppercase tracking-wide flex items-center gap-2">
        <Trash2 className="w-3.5 h-3.5" />
        Limpeza de Dados Corrompidos
      </p>
      <p className="text-xs text-slate-400">
        Use essas opções para remover jogos que foram importados com a liga errada (bug corrigido na
        versão atual).
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => cleanup('wrong_league')}
          disabled={!!cleaning}
          className="px-3 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs rounded-lg hover:bg-amber-500/20 transition disabled:opacity-50"
        >
          {cleaning === 'wrong_league' ? (
            <Loader2
              className="w-3 h-3 inline mr-1"
              style={{ animation: 'spin 1s linear infinite' }}
            />
          ) : null}
          🏳️ Remover ligas erradas (MLS no Brasileirão etc.)
        </button>
        <button
          onClick={() => cleanup('old')}
          disabled={!!cleaning}
          className="px-3 py-2 bg-slate-700/50 border border-slate-600 text-slate-300 text-xs rounded-lg hover:bg-slate-700 transition disabled:opacity-50"
        >
          {cleaning === 'old' ? (
            <Loader2
              className="w-3 h-3 inline mr-1"
              style={{ animation: 'spin 1s linear infinite' }}
            />
          ) : null}
          🗑️ Remover pendências +60 dias
        </button>
        <button
          onClick={() => cleanup('all_pending')}
          disabled={!!cleaning}
          className="px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-lg hover:bg-red-500/20 transition disabled:opacity-50"
        >
          {cleaning === 'all_pending' ? (
            <Loader2
              className="w-3 h-3 inline mr-1"
              style={{ animation: 'spin 1s linear infinite' }}
            />
          ) : null}
          ⚠️ Limpar TODAS as pendências
        </button>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminAccessError, setAdminAccessError] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('equipes');
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamStats, setTeamStats] = useState<TeamStats[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [pendingMatches, setPendingMatches] = useState<Match[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [cornerEdits, setCornerEdits] = useState<Record<number, { home: string; away: string }>>(
    {}
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentAdminPassword, setCurrentAdminPassword] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Auto-fill state
  const [autoFilling, setAutoFilling] = useState(false);
  const [autoFillResult, setAutoFillResult] = useState<{
    filled: number;
    notFound: number;
    errors: number;
    details: Array<{
      id: number;
      match: string;
      status: 'filled' | 'not_found' | 'no_corners' | 'error';
      homeCorners?: number;
      awayCorners?: number;
      note?: string;
    }>;
  } | null>(null);

  // AI state
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    matches?: Array<{
      homeTeam: string;
      awayTeam: string;
      homeCorners: number;
      awayCorners: number;
      date?: string;
      league?: string;
    }>;
    teamStats?: Array<{
      team: string;
      avgCorners: number;
      avgCornersFor?: number;
      avgCornersAgainst?: number;
      gamesPlayed?: number;
    }>;
    error?: string;
  } | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);

  // Import state
  const [importSource, setImportSource] = useState<'365scores' | 'thesportsdb' | 'auto'>('auto');
  const [availableLeagues, setAvailableLeagues] = useState<
    Record<string, Record<string, { name: string }>>
  >({});
  const [selectedLeagues, setSelectedLeagues] = useState<Set<string>>(new Set());
  const [importLoading, setImportLoading] = useState(false);
  const [importResults, setImportResults] = useState<{
    imported: number;
    skipped: number;
    errors: number;
    leagues: Array<{ league: string; imported: number; skipped: number; error?: string }>;
  } | null>(null);
  const [leaguesFetched, setLeaguesFetched] = useState(false);

  // Conflict resolution state
  const [importConflicts, setImportConflicts] = useState<ImportConflict[]>([]);
  const [resolvedConflicts, setResolvedConflicts] = useState<
    Record<string, '365scores' | 'thesportsdb'>
  >({});
  const [resolvingConflicts, setResolvingConflicts] = useState(false);

  // Pending match league-edit
  const [editingLeague, setEditingLeague] = useState<number | null>(null);
  const [newLeagueVal, setNewLeagueVal] = useState('');
  // Smart suggestions
  const [leagueSuggestions, setLeagueSuggestions] = useState<LeagueSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showAllLeagues, setShowAllLeagues] = useState(false);

  // Match / Stats forms
  const [editingStats, setEditingStats] = useState<Partial<TeamStats> | null>(null);
  const [editingMatch, setEditingMatch] = useState<Partial<Match> | null>(null);
  const [todayDate, setTodayDate] = useState('');

  useEffect(() => {
    setTodayDate(new Date().toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    fetch('/api/admin/check')
      .then((r) => r.json())
      .then(
        (data: {
          isAdmin: boolean;
          user?: { email?: string; mustChangePassword?: boolean };
          error?: string;
        }) => {
        setIsAdmin(data.isAdmin);
        setAdminAccessError(data.error ?? null);
        if (data.isAdmin) {
          if (data.user?.email) setAdminEmail(data.user.email);
          const needsPasswordChange = data.user?.mustChangePassword === true;
          setMustChangePassword(needsPasswordChange);
          setShowPasswordForm(needsPasswordChange);
          if (needsPasswordChange) {
            setLoading(false);
          } else {
            loadData();
          }
        }
      })
      .catch(() => {
        setAdminAccessError('Nao consegui verificar o acesso admin agora.');
        setIsAdmin(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'import' && !leaguesFetched) {
      fetch('/api/admin/matches/import')
        .then((r) => r.json())
        .then((data) => {
          setAvailableLeagues(data);
          setLeaguesFetched(true);
        })
        .catch(() => setLeaguesFetched(true));
    }
  }, [activeTab, leaguesFetched]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [teamsRes, statsRes, matchesRes, adminsRes, pendingRes, faqsRes] = await Promise.all([
        fetch('/api/admin/teams'),
        fetch('/api/admin/team-stats'),
        fetch('/api/admin/matches'),
        fetch('/api/admin/admins'),
        fetch('/api/admin/matches/pending'),
        fetch('/api/faq'),
      ]);
      setTeams(await teamsRes.json());
      setTeamStats(await statsRes.json());
      setMatches(await matchesRes.json());
      const adminsData = await adminsRes.json();
      if (adminsRes.ok && Array.isArray(adminsData)) {
        setAdmins(adminsData);
      } else {
        setAdmins([]);
        setMessage({
          type: 'error',
          text: adminsData?.error || 'Nao consegui carregar a lista de administradores.',
        });
      }
      setPendingMatches(await pendingRes.json());
      const faqData = (await faqsRes.json()) as { faqs: FaqItem[] };
      setFaqs(faqData.faqs ?? []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Import helpers ─────────────────────────────────────────────────────────

  const currentGroups = importSource === 'thesportsdb' ? GROUPS_SPORTSDB : GROUPS_365;
  const sourceLeagueKeys =
    importSource === 'auto'
      ? [
          ...new Set([
            ...Object.keys(availableLeagues['365scores'] || {}),
            ...Object.keys(availableLeagues['thesportsdb'] || {}),
          ]),
        ]
      : Object.keys(availableLeagues[importSource] || {});

  const toggleLeague = (key: string) => {
    setSelectedLeagues((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  const toggleGroup = (keys: string[]) => {
    const valid = keys.filter((k) => sourceLeagueKeys.includes(k));
    const allSel = valid.every((k) => selectedLeagues.has(k));
    setSelectedLeagues((prev) => {
      const next = new Set(prev);
      if (allSel) valid.forEach((k) => next.delete(k));
      else valid.forEach((k) => next.add(k));
      return next;
    });
  };
  const selectAll = () => setSelectedLeagues(new Set(sourceLeagueKeys));
  const deselectAll = () => setSelectedLeagues(new Set());

  const handleImport = async () => {
    if (selectedLeagues.size === 0) {
      setMessage({ type: 'error', text: 'Selecione ao menos uma liga para importar' });
      return;
    }
    setImportLoading(true);
    setImportResults(null);
    setImportConflicts([]);
    setResolvedConflicts({});

    if (importSource === 'auto') {
      // Auto mode: prefer 365Scores when both have data, no conflict UI needed
      const leagueArr = Array.from(selectedLeagues);
      let totalImported = 0;
      let totalSkipped = 0;
      let totalErrors = 0;
      const allLeagueResults: Array<{
        league: string;
        imported: number;
        skipped: number;
        error?: string;
      }> = [];

      for (const league of leagueArr) {
        const has365 = Object.keys(availableLeagues['365scores'] || {}).includes(league);
        const hasSDB = Object.keys(availableLeagues['thesportsdb'] || {}).includes(league);

        // Prefer 365Scores when available (more comprehensive), fall back to TheSportsDB
        const source = has365 ? '365scores' : hasSDB ? 'thesportsdb' : null;
        if (!source) {
          totalErrors++;
          continue;
        }

        try {
          const res = await fetch('/api/admin/matches/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ leagues: [league], source }),
          });
          const data = await res.json();
          totalImported += data.imported ?? 0;
          totalSkipped += data.skipped ?? 0;
          if (data.leagues) allLeagueResults.push(...data.leagues);
          else
            allLeagueResults.push({
              league,
              imported: data.imported ?? 0,
              skipped: data.skipped ?? 0,
              error: data.error,
            });
        } catch {
          totalErrors++;
        }
      }

      setImportConflicts([]);
      setImportResults({
        imported: totalImported,
        skipped: totalSkipped,
        errors: totalErrors,
        leagues: allLeagueResults,
      });
      setMessage({
        type: 'success',
        text: `✅ ${totalImported} partidas novas, ${totalSkipped} já existentes${totalErrors > 0 ? `, ${totalErrors} erros` : ''}.`,
      });
      loadData();
    } else {
      // Specific source
      try {
        const res = await fetch('/api/admin/matches/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leagues: Array.from(selectedLeagues), source: importSource }),
        });
        const data = await res.json();
        if (res.ok) {
          setImportResults(data);
          setMessage({
            type: 'success',
            text: `✅ ${data.imported} partidas novas, ${data.skipped} já existentes.`,
          });
          loadData();
        } else {
          setMessage({ type: 'error', text: data.error || 'Erro ao importar' });
        }
      } catch {
        setMessage({ type: 'error', text: 'Erro ao importar' });
      }
    }
    setImportLoading(false);
  };

  const resolveAllConflicts = async () => {
    const unresolved = importConflicts.filter((c) => !resolvedConflicts[c.league]).length;
    if (unresolved > 0) {
      setMessage({
        type: 'error',
        text: `Escolha a fonte para as ${unresolved} liga(s) pendentes`,
      });
      return;
    }
    setResolvingConflicts(true);
    let totalImported = 0;
    const leagueResults: Array<{
      league: string;
      imported: number;
      skipped: number;
      error?: string;
    }> = [];

    for (const conflict of importConflicts) {
      const chosen = resolvedConflicts[conflict.league];
      if (!chosen) continue;
      try {
        const res = await fetch('/api/admin/matches/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leagues: [conflict.league], source: chosen }),
        });
        const data = await res.json();
        totalImported += data.imported ?? 0;
        leagueResults.push({
          league: conflict.leagueName,
          imported: data.imported ?? 0,
          skipped: data.skipped ?? 0,
        });
      } catch {
        leagueResults.push({
          league: conflict.leagueName,
          imported: 0,
          skipped: 0,
          error: 'Erro ao salvar',
        });
      }
    }

    setImportConflicts([]);
    setResolvedConflicts({});
    setImportResults((prev) => ({
      imported: (prev?.imported ?? 0) + totalImported,
      skipped: prev?.skipped ?? 0,
      errors: prev?.errors ?? 0,
      leagues: [...(prev?.leagues ?? []), ...leagueResults],
    }));
    setMessage({
      type: 'success',
      text: `✅ ${totalImported} partidas importadas após resolução de conflitos!`,
    });
    loadData();
    setResolvingConflicts(false);
  };

  const updateMatchLeague = async (matchId: number, newLeague: string) => {
    try {
      const res = await fetch(`/api/admin/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ league: newLeague }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Liga atualizada!' });
        setEditingLeague(null);
        setLeagueSuggestions([]);
        loadData();
      } else setMessage({ type: 'error', text: 'Erro ao atualizar liga' });
    } catch {
      setMessage({ type: 'error', text: 'Erro de rede' });
    }
  };

  const fetchLeagueSuggestions = async (
    matchId: number,
    homeTeam: string,
    awayTeam: string,
    currentLeague: string
  ) => {
    setEditingLeague(matchId);
    setNewLeagueVal(currentLeague);
    setLeagueSuggestions([]);
    setShowAllLeagues(false);
    setSuggestionsLoading(true);
    try {
      const res = await fetch('/api/admin/matches/suggest-league', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ homeTeam, awayTeam, currentLeague }),
      });
      const data = await res.json();
      setLeagueSuggestions(data.suggestions || []);
    } catch {
      // silently fail — user can still use the full dropdown
    } finally {
      setSuggestionsLoading(false);
    }
  };

  // ── Auto-fill ──────────────────────────────────────────────────────────────

  const handleAutoFill = async () => {
    setAutoFilling(true);
    setAutoFillResult(null);
    try {
      const res = await fetch('/api/admin/matches/auto-fill', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Erro ao preencher' });
        return;
      }
      setAutoFillResult(data);
      setMessage({
        type: 'success',
        text: `✅ ${data.filled} preenchidos, ${data.notFound} não encontrados, ${data.errors} erros.`,
      });
      await loadData();
    } catch {
      setMessage({ type: 'error', text: 'Erro de rede' });
    } finally {
      setAutoFilling(false);
    }
  };

  // ── CRUD helpers ───────────────────────────────────────────────────────────

  const saveTeamStats = async () => {
    if (!editingStats) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/team-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingStats),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Estatísticas salvas!' });
        setEditingStats(null);
        loadData();
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  const saveMatch = async () => {
    if (!editingMatch) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingMatch),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Partida salva!' });
        setEditingMatch(null);
        loadData();
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  const deleteMatch = async (id: number) => {
    if (!confirm('Tem certeza?')) return;
    try {
      await fetch(`/api/admin/matches/${id}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: 'Partida excluída!' });
      loadData();
    } catch {
      setMessage({ type: 'error', text: 'Erro ao excluir' });
    }
  };

  const saveCornerData = async (matchId: number) => {
    const edit = cornerEdits[matchId];
    if (!edit || edit.home === '' || edit.away === '') {
      setMessage({ type: 'error', text: 'Preencha os escanteios de ambos os times' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/matches/${matchId}/corners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ home_corners: Number(edit.home), away_corners: Number(edit.away) }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Escanteios salvos!' });
        setCornerEdits((prev) => {
          const next = { ...prev };
          delete next[matchId];
          return next;
        });
        loadData();
      } else setMessage({ type: 'error', text: 'Erro ao salvar escanteios' });
    } catch {
      setMessage({ type: 'error', text: 'Erro ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  const addAdmin = async () => {
    if (!newAdminEmail.trim()) {
      setMessage({ type: 'error', text: 'Digite um email válido' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newAdminEmail.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({
          type: 'success',
          text: data.alreadyExisted ? 'Admin ja existia e esta ativo.' : 'Admin adicionado!',
        });
        setNewAdminEmail('');
        loadData();
      } else setMessage({ type: 'error', text: data.error || 'Erro ao adicionar' });
    } catch {
      setMessage({ type: 'error', text: 'Erro ao adicionar admin' });
    } finally {
      setSaving(false);
    }
  };

  const removeAdmin = async (id: number) => {
    if (!confirm('Remover este admin?')) return;
    try {
      const res = await fetch(`/api/admin/admins/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: 'success', text: 'Admin removido!' });
        loadData();
      } else setMessage({ type: 'error', text: data.error || 'Erro ao remover' });
    } catch {
      setMessage({ type: 'error', text: 'Erro ao remover' });
    }
  };

  const parseWithAI = async () => {
    if (!aiInput.trim()) {
      setMessage({ type: 'error', text: 'Cole o texto primeiro' });
      return;
    }
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch('/api/admin/ai/parse-corners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: aiInput }),
      });
      const data = await res.json();
      setAiResult(data);
      if (data.error && !data.matches?.length && !data.teamStats?.length)
        setMessage({ type: 'error', text: data.error });
      else
        setMessage({
          type: 'success',
          text: `Encontrados: ${data.matches?.length || 0} partidas, ${data.teamStats?.length || 0} estatísticas`,
        });
    } catch {
      setMessage({ type: 'error', text: 'Erro ao processar' });
    } finally {
      setAiLoading(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const formatDateBR = (dateStr: string) => {
    if (!dateStr) return '-';
    const [year, month, day] = dateStr.substring(0, 10).split('-');
    return `${day}/${month}/${year}`;
  };

  const changeAdminPassword = async () => {
    setMessage(null);

    if (!mustChangePassword && !currentAdminPassword.trim()) {
      setMessage({ type: 'error', text: 'Informe a senha atual.' });
      return;
    }

    if (newAdminPassword.length < 8) {
      setMessage({ type: 'error', text: 'A nova senha deve ter pelo menos 8 caracteres.' });
      return;
    }

    if (newAdminPassword !== confirmAdminPassword) {
      setMessage({ type: 'error', text: 'A confirmacao da senha nao confere.' });
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await fetch('/api/admin/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentAdminPassword,
          newPassword: newAdminPassword,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Nao consegui alterar a senha agora.');

      setCurrentAdminPassword('');
      setNewAdminPassword('');
      setConfirmAdminPassword('');
      setMustChangePassword(false);
      setShowPasswordForm(false);
      setMessage({ type: 'success', text: 'Senha admin alterada com sucesso.' });
      await loadData();
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Nao consegui alterar a senha agora.';
      setMessage({ type: 'error', text });
    } finally {
      setPasswordSaving(false);
    }
  };

  // ── Guards ─────────────────────────────────────────────────────────────────

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2
          className="w-8 h-8 text-emerald-400"
          style={{ animation: 'spin 1s linear infinite' }}
        />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8 max-w-md w-full text-center space-y-5">
          <Shield className="w-16 h-16 text-emerald-400 mx-auto" />
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Área de Administrador</h1>
            <p className="text-slate-400 text-sm">Acesso restrito ao painel de controle</p>
          </div>
          {adminAccessError && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-left text-sm text-amber-200">
              {adminAccessError}
            </div>
          )}
          <div className="bg-slate-700/40 border border-emerald-500/30 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-white">Login de administrador</p>
            <a
              href="/admin/login"
              className="block w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2.5 rounded-lg transition text-sm"
            >
              Entrar com email/senha admin →
            </a>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-xs text-slate-500">ou</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>
          <Button
            onClick={() => {
              window.location.href = '/account/signin?callbackUrl=/admin';
            }}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuar com Google
          </Button>
          <a
            href="/admin/emergency"
            className="block text-xs text-amber-400 hover:text-amber-300 transition"
          >
            ⚡ Acesso de emergência via CRON_SECRET
          </a>
          <button
            onClick={() => navigate('/')}
            className="text-slate-500 hover:text-slate-300 flex items-center justify-center gap-2 mx-auto text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao app
          </button>
        </div>
        <style jsx global>{`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </div>
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────

  const displayEmail = adminEmail || user?.email || '';
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>

      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur border-b border-slate-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-bold text-white">Admin Cantos</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">{displayEmail}</span>
            {!mustChangePassword && (
              <Button
                onClick={() => setShowPasswordForm((value) => !value)}
                variant="ghost"
                size="sm"
                className="text-slate-300 hover:text-white"
              >
                <Shield className="w-4 h-4" />
                Alterar senha
              </Button>
            )}
            <Button
              onClick={() => {
                logout();
                navigate('/');
              }}
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Message */}
      {message && (
        <div
          className={`max-w-7xl mx-auto px-4 py-2 mt-4 rounded-lg ${message.type === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}
        >
          {message.text}
          <button onClick={() => setMessage(null)} className="float-right hover:opacity-70">
            ×
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 py-6">
        {(mustChangePassword || showPasswordForm) && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-slate-800/70 p-6 shadow-xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-xl">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <Shield className="w-6 h-6 text-emerald-300" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {mustChangePassword ? 'Criar senha definitiva' : 'Alterar senha admin'}
                    </h2>
                    <p className="text-sm text-slate-400">
                      {mustChangePassword
                        ? 'A senha temporaria funcionou. Agora defina uma senha permanente para liberar o painel.'
                        : 'Atualize sua senha de acesso ao painel administrativo.'}
                    </p>
                  </div>
                </div>
                {mustChangePassword && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                    Por seguranca, o painel fica bloqueado ate voce salvar uma nova senha.
                  </div>
                )}
              </div>

              <div className="w-full max-w-md space-y-3">
                {!mustChangePassword && (
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-slate-300">
                      Senha atual
                    </span>
                    <input
                      type="password"
                      value={currentAdminPassword}
                      onChange={(event) => setCurrentAdminPassword(event.target.value)}
                      className="w-full rounded-xl border border-slate-600 bg-slate-900/70 px-4 py-3 text-white outline-none focus:border-emerald-400"
                    />
                  </label>
                )}
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-300">Nova senha</span>
                  <input
                    type="password"
                    value={newAdminPassword}
                    onChange={(event) => setNewAdminPassword(event.target.value)}
                    className="w-full rounded-xl border border-slate-600 bg-slate-900/70 px-4 py-3 text-white outline-none focus:border-emerald-400"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-slate-300">
                    Confirmar nova senha
                  </span>
                  <input
                    type="password"
                    value={confirmAdminPassword}
                    onChange={(event) => setConfirmAdminPassword(event.target.value)}
                    className="w-full rounded-xl border border-slate-600 bg-slate-900/70 px-4 py-3 text-white outline-none focus:border-emerald-400"
                  />
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    onClick={changeAdminPassword}
                    disabled={passwordSaving}
                    className="flex-1 bg-emerald-500 text-white hover:bg-emerald-600"
                  >
                    {passwordSaving ? (
                      <Loader2
                        className="w-4 h-4"
                        style={{ animation: 'spin 1s linear infinite' }}
                      />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Salvar senha
                  </Button>
                  {!mustChangePassword && (
                    <Button
                      onClick={() => {
                        setShowPasswordForm(false);
                        setCurrentAdminPassword('');
                        setNewAdminPassword('');
                        setConfirmAdminPassword('');
                      }}
                      variant="ghost"
                      className="text-slate-300 hover:text-white"
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {!mustChangePassword && (
          <>
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(
            [
              {
                id: 'automacao',
                label: 'Automação',
                icon: <Zap className="w-4 h-4" />,
                color: 'yellow',
              },
              {
                id: 'import',
                label: 'Importar Ligas',
                icon: <Globe className="w-4 h-4" />,
                color: 'blue',
              },
              {
                id: 'equipes',
                label: 'Estatísticas',
                icon: <Users className="w-4 h-4" />,
                color: 'emerald',
              },
              {
                id: 'matches',
                label: 'Partidas',
                icon: <Calendar className="w-4 h-4" />,
                color: 'emerald',
              },
              {
                id: 'pending',
                label: `Pendências${pendingMatches.length > 0 ? ` (${pendingMatches.length})` : ''}`,
                icon: <AlertTriangle className="w-4 h-4" />,
                color: 'amber',
              },
              {
                id: 'h2h',
                label: 'Confrontos',
                icon: <GitCompare className="w-4 h-4" />,
                color: 'emerald',
              },
              {
                id: 'admins',
                label: 'Admins',
                icon: <UserPlus className="w-4 h-4" />,
                color: 'emerald',
              },
              { id: 'ai', label: 'IA', icon: <Sparkles className="w-4 h-4" />, color: 'purple' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition text-sm ${
                activeTab === tab.id
                  ? tab.color === 'blue'
                    ? 'bg-blue-500 text-white'
                    : tab.color === 'amber'
                      ? 'bg-amber-500 text-white'
                      : tab.color === 'purple'
                        ? 'bg-purple-500 text-white'
                        : tab.color === 'yellow'
                          ? 'bg-yellow-500 text-black'
                          : 'bg-emerald-500 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {loading && activeTab !== 'import' ? (
          <div className="flex justify-center py-12">
            <Loader2
              className="w-8 h-8 text-emerald-400"
              style={{ animation: 'spin 1s linear infinite' }}
            />
          </div>
        ) : (
          <>
            {/* ── AUTOMACAO TAB ────────────────────────────────────────────── */}
            {activeTab === 'automacao' && <AutomacaoTab />}

            {/* ── IMPORT TAB ─────────────────────────────────────────────────── */}
            {activeTab === 'import' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Globe className="w-5 h-5 text-blue-400" />
                      Importar Partidas de Ligas do Mundo
                    </h2>
                    <p className="text-sm text-slate-400 mt-1">
                      Selecione as ligas e importe os próximos jogos automaticamente.
                    </p>
                  </div>
                  <Button
                    onClick={handleImport}
                    disabled={importLoading || selectedLeagues.size === 0}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-6"
                  >
                    {importLoading ? (
                      <>
                        <Loader2
                          className="w-4 h-4 mr-2"
                          style={{ animation: 'spin 1s linear infinite' }}
                        />
                        Importando...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 mr-2" />
                        Importar {selectedLeagues.size > 0 ? `(${selectedLeagues.size})` : ''}
                      </>
                    )}
                  </Button>
                </div>

                {/* Source selector */}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-3 font-medium uppercase tracking-wide">
                    Fonte dos dados
                  </p>
                  <div className="flex gap-3">
                    {[
                      {
                        key: 'auto',
                        icon: '🤖',
                        label: 'Automático',
                        sub: 'Busca em todas as fontes',
                      },
                      {
                        key: '365scores',
                        icon: '📊',
                        label: '365Scores',
                        sub: `~${GROUPS_365.reduce((a, g) => a + g.keys.length, 0)} ligas`,
                      },
                      {
                        key: 'thesportsdb',
                        icon: '🏟️',
                        label: 'TheSportsDB',
                        sub: `~${GROUPS_SPORTSDB.reduce((a, g) => a + g.keys.length, 0)} ligas`,
                      },
                    ].map((s) => (
                      <button
                        key={s.key}
                        onClick={() => {
                          setImportSource(s.key as typeof importSource);
                          setSelectedLeagues(new Set());
                          setImportResults(null);
                          setImportConflicts([]);
                        }}
                        className={`flex-1 px-4 py-3 rounded-lg border transition text-sm font-medium ${importSource === s.key ? (s.key === 'auto' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-blue-500/20 border-blue-500 text-blue-300') : 'bg-slate-700/50 border-slate-600 text-slate-400 hover:text-white'}`}
                      >
                        {s.icon} {s.label}
                        <span className="block text-xs font-normal mt-0.5 opacity-70">{s.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Select all */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={selectAll}
                    className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300"
                  >
                    <CheckSquare className="w-4 h-4" />
                    Selecionar todas
                  </button>
                  <button
                    onClick={deselectAll}
                    className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-300"
                  >
                    <Square className="w-4 h-4" />
                    Desmarcar todas
                  </button>
                  <span className="text-sm text-slate-500 ml-auto">
                    {selectedLeagues.size} liga{selectedLeagues.size !== 1 ? 's' : ''} selecionada
                    {selectedLeagues.size !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* League groups */}
                <div className="space-y-4">
                  {currentGroups.map((group) => {
                    const validKeys = group.keys.filter((k) =>
                      sourceLeagueKeys.length === 0 ? true : sourceLeagueKeys.includes(k)
                    );
                    if (validKeys.length === 0) return null;
                    const allSelected = validKeys.every((k) => selectedLeagues.has(k));
                    const someSelected = validKeys.some((k) => selectedLeagues.has(k));
                    const src = (availableLeagues[
                      importSource === 'auto' ? '365scores' : importSource
                    ] || {}) as Record<string, { name: string }>;
                    return (
                      <div
                        key={group.label}
                        className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden"
                      >
                        <button
                          onClick={() => toggleGroup(validKeys)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-slate-700/40 hover:bg-slate-700/60 transition"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{group.flag}</span>
                            <span className="text-white font-medium">{group.label}</span>
                            <span className="text-xs text-slate-400">
                              ({validKeys.length} ligas)
                            </span>
                          </div>
                          <div
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition ${allSelected ? 'bg-blue-500 border-blue-500' : someSelected ? 'bg-blue-500/30 border-blue-500' : 'border-slate-500'}`}
                          >
                            {(allSelected || someSelected) && (
                              <Check className="w-3 h-3 text-white" />
                            )}
                          </div>
                        </button>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                          {validKeys.map((key) => {
                            const name = src[key]?.name || key;
                            const isSel = selectedLeagues.has(key);
                            return (
                              <button
                                key={key}
                                onClick={() => toggleLeague(key)}
                                className={`flex items-center gap-3 px-4 py-2.5 text-left transition border-b border-slate-700/30 hover:bg-slate-700/30 ${isSel ? 'bg-blue-500/10' : ''}`}
                              >
                                <div
                                  className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition ${isSel ? 'bg-blue-500 border-blue-500' : 'border-slate-500'}`}
                                >
                                  {isSel && <Check className="w-2.5 h-2.5 text-white" />}
                                </div>
                                <span
                                  className={`text-sm ${isSel ? 'text-white' : 'text-slate-300'}`}
                                >
                                  {name}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Import Results */}
                {importResults && (
                  <div className="bg-slate-800/50 border border-emerald-500/30 rounded-xl p-5">
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      <Download className="w-4 h-4 text-emerald-400" />
                      Resultado da Importação
                    </h3>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-emerald-400">
                          {importResults.imported}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">Novas partidas</p>
                      </div>
                      <div className="bg-slate-700/30 border border-slate-600/30 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-slate-400">{importResults.skipped}</p>
                        <p className="text-xs text-slate-400 mt-1">Já existiam</p>
                      </div>
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-red-400">{importResults.errors}</p>
                        <p className="text-xs text-slate-400 mt-1">Erros</p>
                      </div>
                    </div>
                    {importResults.leagues.length > 0 && (
                      <div className="space-y-1 max-h-60 overflow-y-auto">
                        {importResults.leagues.map((l, i) => (
                          <div
                            key={i}
                            className={`flex items-center justify-between px-3 py-1.5 rounded text-xs ${l.error ? 'bg-red-500/10 text-red-400' : 'bg-slate-700/30 text-slate-300'}`}
                          >
                            <span>{l.league}</span>
                            <span>
                              {l.error ? `❌ ${l.error}` : `+${l.imported} | skip:${l.skipped}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Conflict Resolution */}
                {importConflicts.length > 0 && (
                  <div className="bg-slate-800/50 border border-amber-500/30 rounded-xl p-5 space-y-4">
                    <h3 className="text-white font-semibold flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                      Conflitos Detectados — Escolha a Fonte
                    </h3>
                    <p className="text-sm text-slate-400">
                      As ligas abaixo existem em ambas as fontes. Escolha qual usar para cada uma.
                    </p>
                    <div className="space-y-3">
                      {importConflicts.map((conflict) => (
                        <div
                          key={conflict.league}
                          className="bg-slate-700/40 border border-slate-600 rounded-lg p-4"
                        >
                          <p className="text-white font-medium mb-3">{conflict.leagueName}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {[
                              { key: '365scores' as const, icon: '📊', label: '365Scores' },
                              { key: 'thesportsdb' as const, icon: '🏟️', label: 'TheSportsDB' },
                            ].map((src) => {
                              const isChosen = resolvedConflicts[conflict.league] === src.key;
                              return (
                                <button
                                  key={src.key}
                                  onClick={() =>
                                    setResolvedConflicts((prev) => ({
                                      ...prev,
                                      [conflict.league]: src.key,
                                    }))
                                  }
                                  className={`text-left p-3 rounded-lg border-2 transition ${isChosen ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'}`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span
                                      className={`font-medium text-sm ${isChosen ? 'text-emerald-400' : 'text-slate-300'}`}
                                    >
                                      {src.icon} {src.label}
                                    </span>
                                    {isChosen && (
                                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Selecionado
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-400">
                                    Clique para usar esta fonte
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <Button
                        onClick={resolveAllConflicts}
                        disabled={
                          resolvingConflicts ||
                          Object.keys(resolvedConflicts).length < importConflicts.length
                        }
                        className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6"
                      >
                        {resolvingConflicts ? (
                          <>
                            <Loader2
                              className="w-4 h-4 mr-2"
                              style={{ animation: 'spin 1s linear infinite' }}
                            />
                            Importando...
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4 mr-2" />
                            Confirmar ({Object.keys(resolvedConflicts).length}/
                            {importConflicts.length})
                          </>
                        )}
                      </Button>
                      <Button
                        onClick={() => {
                          setImportConflicts([]);
                          setResolvedConflicts({});
                        }}
                        variant="outline"
                        className="border-slate-600 text-slate-400"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 text-sm text-slate-400">
                  <p className="font-medium text-blue-400 mb-1">💡 Dica</p>
                  <p>
                    Use o modo <strong className="text-emerald-300">Automático</strong> — ele busca
                    em todas as fontes e avisa quando uma liga existir em mais de um lugar para você
                    escolher. A liga selecionada sempre é salva com o identificador correto, então o
                    auto-fill consegue encontrar os escanteios depois.
                  </p>
                </div>
              </div>
            )}

            {/* ── STATS TAB ──────────────────────────────────────────────────── */}
            {activeTab === 'equipes' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-white">
                    Estatísticas de Times ({teamStats.length})
                  </h2>
                  <Button
                    onClick={() =>
                      setEditingStats({
                        season: '2026',
                        games_played: 0,
                        avg_corners: 0,
                        home_avg: 0,
                        away_avg: 0,
                        over_85_pct: 0,
                        over_95_pct: 0,
                        over_105_pct: 0,
                        over_115_pct: 0,
                      })
                    }
                    className="bg-emerald-500 hover:bg-emerald-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
                {editingStats && (
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <h3 className="text-white font-medium mb-4">
                      {editingStats.id ? 'Editar' : 'Nova'} Estatística
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Time</label>
                        <select
                          value={editingStats.team_id || ''}
                          onChange={(e) =>
                            setEditingStats({ ...editingStats, team_id: Number(e.target.value) })
                          }
                          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                        >
                          <option value="">Selecione...</option>
                          {teams.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      {[
                        { key: 'season', label: 'Temporada', type: 'text' },
                        { key: 'games_played', label: 'Jogos', type: 'number' },
                        { key: 'avg_corners', label: 'Média Esc.', type: 'number', step: '0.1' },
                        { key: 'home_avg', label: 'Média Casa', type: 'number', step: '0.1' },
                        { key: 'away_avg', label: 'Média Fora', type: 'number', step: '0.1' },
                        { key: 'over_85_pct', label: 'Over 8.5 %', type: 'number' },
                        { key: 'over_95_pct', label: 'Over 9.5 %', type: 'number' },
                      ].map((f) => (
                        <div key={f.key}>
                          <label className="text-xs text-slate-400 block mb-1">{f.label}</label>
                          <input
                            type={f.type}
                            step={(f as { step?: string }).step}
                            value={
                              ((editingStats as Record<string, unknown>)[f.key] as string) ?? ''
                            }
                            onChange={(e) =>
                              setEditingStats({
                                ...editingStats,
                                [f.key]:
                                  f.type === 'number' ? Number(e.target.value) : e.target.value,
                              })
                            }
                            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        onClick={saveTeamStats}
                        disabled={saving}
                        className="bg-emerald-500 hover:bg-emerald-600"
                      >
                        {saving ? (
                          <Loader2
                            className="w-4 h-4 mr-2"
                            style={{ animation: 'spin 1s linear infinite' }}
                          />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Salvar
                      </Button>
                      <Button
                        onClick={() => setEditingStats(null)}
                        variant="outline"
                        className="border-slate-600"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-700/50">
                      <tr>
                        {['Time', 'Temp.', 'Jogos', 'Média', 'Casa', 'Fora', 'Ações'].map((h) => (
                          <th
                            key={h}
                            className={`${h === 'Time' ? 'text-left' : 'text-center'} px-4 py-3 text-xs text-slate-400`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {teamStats.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-500">
                            Nenhuma estatística cadastrada
                          </td>
                        </tr>
                      ) : (
                        teamStats.map((stat) => (
                          <tr key={stat.id} className="border-t border-slate-700/50">
                            <td className="px-4 py-3 text-white">
                              {stat.team_name || `Team ${stat.team_id}`}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-400">{stat.season}</td>
                            <td className="px-4 py-3 text-center text-slate-400">
                              {stat.games_played}
                            </td>
                            <td className="px-4 py-3 text-center text-emerald-400 font-medium">
                              {stat.avg_corners}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-400">
                              {stat.home_avg}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-400">
                              {stat.away_avg}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => setEditingStats(stat)}
                                className="text-slate-400 hover:text-white"
                              >
                                Editar
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── MATCHES TAB ────────────────────────────────────────────────── */}
            {activeTab === 'matches' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-white">
                    Próximas Partidas ({matches.length})
                  </h2>
                  <Button
                    onClick={() =>
                      setEditingMatch({
                        league: 'brasileirao_a',
                        match_date: todayDate,
                        match_time: '16:00',
                      })
                    }
                    className="bg-emerald-500 hover:bg-emerald-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                </div>
                {editingMatch && (
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <h3 className="text-white font-medium mb-4">
                      {editingMatch.id ? 'Editar' : 'Nova'} Partida
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {[
                        {
                          key: 'home_team',
                          label: 'Time Casa',
                          type: 'text',
                          placeholder: 'Flamengo',
                        },
                        {
                          key: 'away_team',
                          label: 'Time Fora',
                          type: 'text',
                          placeholder: 'Palmeiras',
                        },
                        { key: 'match_date', label: 'Data', type: 'date' },
                        { key: 'match_time', label: 'Horário', type: 'time' },
                      ].map((f) => (
                        <div key={f.key}>
                          <label className="text-xs text-slate-400 block mb-1">{f.label}</label>
                          <input
                            type={f.type}
                            placeholder={(f as { placeholder?: string }).placeholder}
                            value={
                              ((editingMatch as Record<string, unknown>)[f.key] as string) ?? ''
                            }
                            onChange={(e) =>
                              setEditingMatch({ ...editingMatch, [f.key]: e.target.value })
                            }
                            className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                          />
                        </div>
                      ))}
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Liga</label>
                        <select
                          value={editingMatch.league || ''}
                          onChange={(e) =>
                            setEditingMatch({ ...editingMatch, league: e.target.value })
                          }
                          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                        >
                          {ALL_LEAGUE_OPTIONS.map((o) => (
                            <option key={o.key} value={o.key}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Rodada</label>
                        <input
                          type="text"
                          placeholder="8"
                          value={editingMatch.round || ''}
                          onChange={(e) =>
                            setEditingMatch({ ...editingMatch, round: e.target.value })
                          }
                          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-xs text-slate-400 block mb-1">Árbitro</label>
                        <input
                          type="text"
                          placeholder="Raphael Claus"
                          value={editingMatch.referee || ''}
                          onChange={(e) =>
                            setEditingMatch({ ...editingMatch, referee: e.target.value })
                          }
                          className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        onClick={saveMatch}
                        disabled={saving}
                        className="bg-emerald-500 hover:bg-emerald-600"
                      >
                        {saving ? (
                          <Loader2
                            className="w-4 h-4 mr-2"
                            style={{ animation: 'spin 1s linear infinite' }}
                          />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Salvar
                      </Button>
                      <Button
                        onClick={() => setEditingMatch(null)}
                        variant="outline"
                        className="border-slate-600"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-700/50">
                      <tr>
                        {['Partida', 'Data', 'Hora', 'Liga', 'Rodada', 'Árbitro', 'Ações'].map(
                          (h) => (
                            <th
                              key={h}
                              className={`${h === 'Partida' ? 'text-left' : 'text-center'} px-4 py-3 text-xs text-slate-400`}
                            >
                              {h}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {matches.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-slate-500">
                            Nenhuma partida cadastrada
                          </td>
                        </tr>
                      ) : (
                        matches.map((match) => (
                          <tr key={match.id} className="border-t border-slate-700/50">
                            <td className="px-4 py-3 text-white">
                              {match.home_team} vs {match.away_team}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-400">
                              {match.match_date}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-400">
                              {match.match_time}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-400 text-xs">
                              {ALL_LEAGUE_OPTIONS.find((o) => o.key === match.league)?.label ||
                                match.league}
                            </td>
                            <td className="px-4 py-3 text-center text-slate-400">{match.round}</td>
                            <td className="px-4 py-3 text-center text-slate-400">
                              {match.referee || '-'}
                            </td>
                            <td className="px-4 py-3 text-center flex items-center justify-center gap-2">
                              <button
                                onClick={() => setEditingMatch(match)}
                                className="text-slate-400 hover:text-white"
                              >
                                Editar
                              </button>
                              <button
                                onClick={() => deleteMatch(match.id)}
                                className="text-red-400 hover:text-red-300"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── PENDING TAB ────────────────────────────────────────────────── */}
            {activeTab === 'pending' && (
              <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      Partidas Pendentes ({pendingMatches.length})
                    </h2>
                    <p className="text-sm text-slate-400 mt-0.5">
                      Partidas já realizadas sem dados de escanteios. Clique na liga para corrigir
                      se estiver errada.
                    </p>
                  </div>
                  <Button
                    onClick={() => void handleAutoFill()}
                    disabled={autoFilling || pendingMatches.length === 0}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-5 flex items-center gap-2 shrink-0"
                  >
                    {autoFilling ? (
                      <>
                        <Loader2
                          className="w-4 h-4 mr-2"
                          style={{ animation: 'spin 1s linear infinite' }}
                        />
                        Buscando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />⚡ Auto-preencher com Sofascore
                      </>
                    )}
                  </Button>
                </div>

                {/* ── Mass cleanup banner ─────────────────────────────────────── */}
                {pendingMatches.length > 30 && (
                  <div className="bg-red-500/10 border-2 border-red-500/40 rounded-xl p-5 space-y-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-red-300 font-bold text-base">
                          {pendingMatches.length} partidas com liga errada detectadas
                        </p>
                        <p className="text-slate-400 text-sm mt-1">
                          Esses jogos foram importados incorretamente pelo bug anterior (o sync
                          sobrescrevia a liga de jogos já existentes). O bug já foi corrigido.
                          <br />
                          <strong className="text-amber-300">Recomendação:</strong> Limpe tudo agora
                          e reimporte usando a aba{' '}
                          <strong className="text-yellow-400">Automação</strong>.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3 pt-1">
                      <button
                        onClick={async () => {
                          if (
                            !confirm(
                              `Apagar TODAS as ${pendingMatches.length} partidas pendentes e começar do zero?`
                            )
                          )
                            return;
                          try {
                            const res = await fetch('/api/admin/matches/pending', {
                              method: 'DELETE',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ mode: 'all_pending' }),
                            });
                            const data = (await res.json()) as { deleted: number; message: string };
                            setMessage({
                              type: 'success',
                              text: `🗑️ ${data.message} — Agora vá em Automação → Executar para reimportar.`,
                            });
                            await loadData();
                          } catch {
                            setMessage({ type: 'error', text: 'Erro ao limpar' });
                          }
                        }}
                        className="bg-red-600 hover:bg-red-500 text-white font-bold px-5 py-2.5 rounded-lg text-sm transition flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        🗑️ Limpar TODAS ({pendingMatches.length})
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm('Remover pendências com mais de 60 dias?')) return;
                          try {
                            const res = await fetch('/api/admin/matches/pending', {
                              method: 'DELETE',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ mode: 'old', cutoffDays: 60 }),
                            });
                            const data = (await res.json()) as { deleted: number; message: string };
                            setMessage({ type: 'success', text: `✅ ${data.message}` });
                            await loadData();
                          } catch {
                            setMessage({ type: 'error', text: 'Erro ao limpar' });
                          }
                        }}
                        className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold px-4 py-2.5 rounded-lg text-sm transition flex items-center gap-2 border border-slate-600"
                      >
                        🗑️ Só +60 dias
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">
                      Após limpar, vá em{' '}
                      <strong className="text-yellow-400">Automação → Executar Agora</strong> para
                      importar apenas os jogos das ligas corretas.
                    </p>
                  </div>
                )}

                {/* Auto-fill result */}
                {autoFillResult && (
                  <div className="bg-slate-800/50 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                    <h3 className="text-white font-medium flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-400" />
                      Resultado do Auto-fill
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-emerald-400">
                          {autoFillResult.filled}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">Preenchidos</p>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-amber-400">
                          {autoFillResult.notFound}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">Não encontrados</p>
                      </div>
                      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-red-400">{autoFillResult.errors}</p>
                        <p className="text-xs text-slate-400 mt-1">Erros</p>
                      </div>
                    </div>
                    {autoFillResult.details.length > 0 && (
                      <div className="space-y-1 max-h-52 overflow-y-auto">
                        {autoFillResult.details.map((d, i) => (
                          <div
                            key={i}
                            className={`flex items-start justify-between px-3 py-2 rounded text-xs gap-2 ${d.status === 'filled' ? 'bg-emerald-500/10 text-emerald-300' : d.status === 'error' ? 'bg-red-500/10 text-red-300' : 'bg-slate-700/40 text-slate-400'}`}
                          >
                            <span className="truncate flex-1">{d.match}</span>
                            <span className="shrink-0">
                              {d.status === 'filled'
                                ? `✅ ${d.homeCorners}-${d.awayCorners}`
                                : d.status === 'error'
                                  ? `❌ ${d.note ?? 'erro'}`
                                  : `⚠️ ${d.note ?? 'não encontrado'}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {pendingMatches.length === 0 ? (
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-8 text-center">
                    <AlertTriangle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
                    <p className="text-slate-400">
                      Nenhuma partida pendente! Todos os dados estão atualizados.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingMatches.map((match) => {
                      const edit = cornerEdits[match.id] || { home: '', away: '' };
                      const leagueLabel =
                        ALL_LEAGUE_OPTIONS.find((o) => o.key === match.league)?.label ||
                        match.league;
                      return (
                        <div
                          key={match.id}
                          className="bg-slate-800/50 border border-amber-500/30 rounded-xl p-4"
                        >
                          {/* Smart league selector panel — shown when this match is being edited */}
                          {editingLeague === match.id && (
                            <div className="mb-4 bg-slate-900/60 border border-slate-600 rounded-xl p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">
                                  Escolher liga correta
                                </p>
                                <button
                                  onClick={() => {
                                    setEditingLeague(null);
                                    setLeagueSuggestions([]);
                                  }}
                                  className="text-slate-500 hover:text-slate-300 text-xs"
                                >
                                  ✕ fechar
                                </button>
                              </div>

                              {/* Suggestions */}
                              {suggestionsLoading && (
                                <div className="flex items-center gap-2 text-xs text-slate-400">
                                  <Loader2
                                    className="w-3 h-3"
                                    style={{ animation: 'spin 1s linear infinite' }}
                                  />
                                  Analisando os times...
                                </div>
                              )}

                              {!suggestionsLoading && leagueSuggestions.length > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-xs text-emerald-400 font-medium">
                                    ✨ Sugestões com base nos times:
                                  </p>
                                  {leagueSuggestions.map((sug) => (
                                    <button
                                      key={sug.key}
                                      onClick={() => updateMatchLeague(match.id, sug.key)}
                                      className={`w-full text-left px-3 py-2.5 rounded-lg border transition ${sug.score >= 10 ? 'border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20' : 'border-slate-600 bg-slate-800 hover:bg-slate-700'}`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div>
                                          <span
                                            className={`text-sm font-semibold ${sug.score >= 10 ? 'text-emerald-300' : 'text-slate-200'}`}
                                          >
                                            {sug.name}
                                          </span>
                                          {sug.country && (
                                            <span className="text-slate-500 text-xs ml-2">
                                              • {sug.country}
                                            </span>
                                          )}
                                        </div>
                                        {sug.score >= 10 && (
                                          <span className="shrink-0 text-xs text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                                            ⭐ Melhor match
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-slate-400 mt-0.5">{sug.reason}</p>
                                    </button>
                                  ))}
                                </div>
                              )}

                              {!suggestionsLoading && leagueSuggestions.length === 0 && (
                                <p className="text-xs text-slate-500 italic">
                                  Times não reconhecidos na base de dados — use o seletor abaixo
                                </p>
                              )}

                              {/* Full dropdown fallback */}
                              <div className="pt-1 border-t border-slate-700/50">
                                <button
                                  onClick={() => setShowAllLeagues((v) => !v)}
                                  className="text-xs text-slate-400 hover:text-slate-200 underline"
                                >
                                  {showAllLeagues
                                    ? '▲ Ocultar lista completa'
                                    : '▼ Ver todas as ligas'}
                                </button>
                                {showAllLeagues && (
                                  <div className="mt-2 flex gap-2">
                                    <select
                                      value={newLeagueVal}
                                      onChange={(e) => setNewLeagueVal(e.target.value)}
                                      className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-white"
                                    >
                                      {ALL_LEAGUE_OPTIONS.map((o) => (
                                        <option key={o.key} value={o.key}>
                                          {o.label}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={() => updateMatchLeague(match.id, newLeagueVal)}
                                      className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded text-xs font-semibold flex items-center gap-1"
                                    >
                                      <Save className="w-3 h-3" />
                                      Salvar
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          <div className="flex flex-col md:flex-row md:items-center gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <button
                                  onClick={() =>
                                    fetchLeagueSuggestions(
                                      match.id,
                                      match.home_team,
                                      match.away_team,
                                      match.league
                                    )
                                  }
                                  className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded hover:bg-amber-500/30 transition cursor-pointer"
                                  title="Clique para alterar a liga"
                                >
                                  {leagueLabel} ✏️
                                </button>
                                <span className="text-xs text-slate-500">Rodada {match.round}</span>
                              </div>
                              <p className="text-white font-medium">
                                {match.home_team} vs {match.away_team}
                              </p>
                              <p className="text-sm text-slate-400">
                                {match.match_date} às {match.match_time}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              {['home', 'away'].map((side, idx) => (
                                <>
                                  {idx === 1 && (
                                    <span key="sep" className="text-slate-500">
                                      ×
                                    </span>
                                  )}
                                  <div key={side} className="text-center">
                                    <label className="text-xs text-slate-400 block mb-1">
                                      {side === 'home'
                                        ? match.home_team.split(' ')[0]
                                        : match.away_team.split(' ')[0]}
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      max="30"
                                      value={side === 'home' ? edit.home : edit.away}
                                      onChange={(e) =>
                                        setCornerEdits((prev) => ({
                                          ...prev,
                                          [match.id]: { ...edit, [side]: e.target.value },
                                        }))
                                      }
                                      className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-2 text-white text-center"
                                      placeholder="0"
                                    />
                                  </div>
                                </>
                              ))}
                              <Button
                                onClick={() => saveCornerData(match.id)}
                                disabled={saving || !edit.home || !edit.away}
                                size="sm"
                                className="bg-emerald-500 hover:bg-emerald-600 ml-2"
                              >
                                {saving ? (
                                  <Loader2
                                    className="w-4 h-4"
                                    style={{ animation: 'spin 1s linear infinite' }}
                                  />
                                ) : (
                                  <Save className="w-4 h-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── H2H TAB ────────────────────────────────────────────────────── */}
            {activeTab === 'h2h' && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 text-center">
                <GitCompare className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">Gestão de confrontos diretos em breve.</p>
              </div>
            )}

            {/* ── ADMINS TAB ─────────────────────────────────────────────────── */}
            {activeTab === 'admins' && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white">
                  Administradores ({admins.length})
                </h2>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                  <h3 className="text-white font-medium mb-2">Adicionar Administrador</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    O email de Google da pessoa que vai ter acesso ao painel.
                  </p>
                  <div className="flex gap-3">
                    <input
                      type="email"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      placeholder="email@gmail.com"
                      className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-2 text-white placeholder:text-slate-500"
                    />
                    <Button
                      onClick={addAdmin}
                      disabled={saving || !newAdminEmail.trim()}
                      className="bg-emerald-500 hover:bg-emerald-600"
                    >
                      {saving ? (
                        <Loader2
                          className="w-4 h-4"
                          style={{ animation: 'spin 1s linear infinite' }}
                        />
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Adicionar
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-slate-700/50">
                      <tr>
                        {['Email', 'Status', 'Desde', 'Ações'].map((h) => (
                          <th
                            key={h}
                            className={`${h === 'Email' ? 'text-left' : 'text-center'} px-4 py-3 text-xs text-slate-400`}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {admins.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-8 text-slate-500">
                            Nenhum administrador cadastrado
                          </td>
                        </tr>
                      ) : (
                        admins.map((admin) => (
                          <tr key={admin.id} className="border-t border-slate-700/50">
                            <td className="px-4 py-3 text-white flex items-center gap-2">
                              <Shield className="w-4 h-4 text-emerald-400" />
                              {admin.email}
                              {(admin.email === user?.email || admin.email === adminEmail) && (
                                <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                                  você
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`text-xs px-2 py-1 rounded ${admin.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-600/20 text-slate-400'}`}
                              >
                                {admin.is_active ? 'Ativo' : 'Pendente'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-slate-400 text-sm">
                              {formatDateBR(admin.created_at)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {admin.email !== user?.email && admin.email !== adminEmail && (
                                <button
                                  onClick={() => removeAdmin(admin.id)}
                                  className="text-red-400 hover:text-red-300"
                                  title="Remover"
                                >
                                  <Trash2 className="w-4 h-4 inline" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── AI TAB ─────────────────────────────────────────────────────── */}
            {activeTab === 'ai' && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-400" />
                  Assistente IA
                </h2>
                <div className="bg-slate-800/50 border border-purple-500/30 rounded-xl p-4">
                  <h3 className="text-white font-medium mb-2">Extrair Dados de Escanteios</h3>
                  <p className="text-sm text-slate-400 mb-4">
                    Cole textos de Sofascore, FlashScore ou qualquer site. A IA extrai os dados
                    automaticamente.
                  </p>
                  <textarea
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder="Cole aqui o texto com dados de escanteios..."
                    className="w-full h-48 bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder:text-slate-500 resize-none font-mono text-sm"
                  />
                  <div className="flex gap-3 mt-4">
                    <Button
                      onClick={parseWithAI}
                      disabled={aiLoading || !aiInput.trim()}
                      className="bg-purple-500 hover:bg-purple-600"
                    >
                      {aiLoading ? (
                        <Loader2
                          className="w-4 h-4 mr-2"
                          style={{ animation: 'spin 1s linear infinite' }}
                        />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      Processar com IA
                    </Button>
                    <Button
                      onClick={() => {
                        setAiInput('');
                        setAiResult(null);
                      }}
                      variant="outline"
                      className="border-slate-600"
                    >
                      Limpar
                    </Button>
                  </div>
                </div>

                {aiResult && (
                  <div className="space-y-4">
                    {aiResult.matches && aiResult.matches.length > 0 && (
                      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-emerald-400" />
                          Partidas Encontradas ({aiResult.matches.length})
                        </h3>
                        <div className="space-y-2">
                          {aiResult.matches.map((match, i) => (
                            <div
                              key={i}
                              className="bg-slate-700/50 rounded-lg p-3 flex items-center justify-between"
                            >
                              <div className="flex-1">
                                <p className="text-white">
                                  {match.homeTeam} vs {match.awayTeam}
                                </p>
                                <p className="text-sm text-slate-400">
                                  Esc: {match.homeCorners} - {match.awayCorners}
                                  {match.date && ` • ${match.date}`}
                                  {match.league && ` • ${match.league}`}
                                </p>
                              </div>
                              <button
                                onClick={() =>
                                  copyToClipboard(
                                    `${match.homeTeam}\t${match.awayTeam}\t${match.homeCorners}\t${match.awayCorners}`,
                                    i
                                  )
                                }
                                className="text-slate-400 hover:text-white p-2"
                              >
                                {copiedIndex === i ? (
                                  <Check className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {aiResult.teamStats && aiResult.teamStats.length > 0 && (
                      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                        <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-400" />
                          Estatísticas de Times ({aiResult.teamStats.length})
                        </h3>
                        <div className="space-y-2">
                          {aiResult.teamStats.map((stat, i) => (
                            <div
                              key={i}
                              className="bg-slate-700/50 rounded-lg p-3 flex items-center justify-between"
                            >
                              <div className="flex-1">
                                <p className="text-white font-medium">{stat.team}</p>
                                <p className="text-sm text-slate-400">
                                  Média: {stat.avgCorners.toFixed(1)}
                                  {stat.avgCornersFor !== undefined &&
                                    ` • A favor: ${stat.avgCornersFor.toFixed(1)}`}
                                  {stat.avgCornersAgainst !== undefined &&
                                    ` • Contra: ${stat.avgCornersAgainst.toFixed(1)}`}
                                  {stat.gamesPlayed && ` • ${stat.gamesPlayed} jogos`}
                                </p>
                              </div>
                              <button
                                onClick={() =>
                                  copyToClipboard(
                                    `${stat.team}\t${stat.avgCorners}\t${stat.avgCornersFor || ''}\t${stat.avgCornersAgainst || ''}\t${stat.gamesPlayed || ''}`,
                                    i + 1000
                                  )
                                }
                                className="text-slate-400 hover:text-white p-2"
                              >
                                {copiedIndex === i + 1000 ? (
                                  <Check className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Copy className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {(!aiResult.matches || aiResult.matches.length === 0) &&
                      (!aiResult.teamStats || aiResult.teamStats.length === 0) && (
                        <div className="bg-slate-800/50 border border-amber-500/30 rounded-xl p-6 text-center">
                          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                          <p className="text-white font-medium">Nenhum dado encontrado</p>
                          <p className="text-sm text-slate-400 mt-1">
                            {aiResult.error || 'Tente colar um texto com dados de escanteios.'}
                          </p>
                        </div>
                      )}
                  </div>
                )}

                {faqs.length > 0 && (
                  <div className="bg-slate-800/50 border border-emerald-500/20 rounded-xl p-4">
                    <h4 className="text-white font-medium mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      Perguntas Frequentes dos Usuários
                    </h4>
                    <div className="space-y-2">
                      {faqs.map((faq, i) => (
                        <div
                          key={i}
                          className="bg-slate-700/50 rounded-lg px-4 py-3 flex items-center justify-between gap-3"
                        >
                          <p className="text-sm text-slate-300 flex-1">{faq.question}</p>
                          <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full font-semibold whitespace-nowrap">
                            {faq.asked_count}× perguntada
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
          </>
        )}
      </div>
    </div>
  );
}
