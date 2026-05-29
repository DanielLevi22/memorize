import { useState, useMemo, useEffect } from 'react';
import { 
  BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, 
  ComposedChart
} from 'recharts';
import { Card as ShadcnCard } from './ui/card';
import { Button } from './ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from './ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import type { Deck, Card, Revision } from '../types';
import { Sparkles } from 'lucide-react';

interface StatsDashboardProps {
  decks: Deck[] | undefined;
  cards: Card[] | undefined;
  revisions: Revision[] | undefined;
  selectedAlgo?: 'SM-2' | 'FSRS';
}

const getLocalDateStr = (timestamp: number) => {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export function StatsDashboard({ decks = [], cards = [], revisions = [], selectedAlgo = 'SM-2' }: StatsDashboardProps) {
  // --- FILTROS DE ESTADO ---
  const [selectedScope, setSelectedScope] = useState<'collection' | string>('collection');
  const [period, setPeriod] = useState<'12months' | 'all'>('12months');
  
  const [activeAlgoView, setActiveAlgoView] = useState<'SM-2' | 'FSRS'>(selectedAlgo);

  useEffect(() => {
    setActiveAlgoView(selectedAlgo);
  }, [selectedAlgo]);
  
  // Filtro de ano do Calendário
  const currentYear = new Date().getFullYear();
  const [calendarYear, setCalendarYear] = useState<number>(currentYear);

  // Filtros de Gráficos individuais
  const [forecastHorizon, setForecastHorizon] = useState<'1m' | '3m' | '1y' | 'all'>('1m');
  const [forecastAccumulated, setForecastAccumulated] = useState<boolean>(false);

  const [reviewsPeriod, setReviewsPeriod] = useState<'7d' | '1m' | '3m' | '1y'>('1m');
  const [reviewsType, setReviewsType] = useState<'count' | 'time'>('count');

  const [easeScope] = useState<'all' | 'mature'>('all');
  
  const [hourlyPeriod, setHourlyPeriod] = useState<'1m' | '3m' | '1y'>('1m');
  const [buttonsPeriod, setButtonsPeriod] = useState<'1m' | '3m' | '1y'>('1m');
  const [addedPeriod, setAddedPeriod] = useState<'1m' | '3m' | '1y' | 'all'>('1m');

  const todayStr = new Date().toISOString().split('T')[0];

  // --- FILTRAGEM DOS DADOS ---
  // 1. Filtrar Cartões por Deck Selecionado
  const deckCards = useMemo(() => {
    if (selectedScope === 'collection') return cards;
    return cards.filter(c => c.deckId === selectedScope);
  }, [cards, selectedScope]);

  const deckCardIds = useMemo(() => new Set(deckCards.map(c => c.id)), [deckCards]);

  // 2. Filtrar Revisões por Deck Selecionado
  const deckRevisions = useMemo(() => {
    return revisions.filter(r => deckCardIds.has(r.cardId));
  }, [revisions, deckCardIds]);

  // --- 1. HOJE ---
  const statsHoje = useMemo(() => {
    const startOfTodayMs = new Date().setHours(0, 0, 0, 0);
    const revisionsHoje = deckRevisions.filter(r => r.timestamp >= startOfTodayMs);

    if (revisionsHoje.length === 0) {
      return { count: 0, minutes: 0, sPerCard: 0, learning: 0, review: 0, relearning: 0, filtered: 0, correctRate: 0, correctCount: 0, totalOld: 0 };
    }

    // Calcular tempo gasto
    const sorted = [...revisionsHoje].sort((a, b) => a.timestamp - b.timestamp);
    let totalSeconds = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0) {
        totalSeconds += 10;
      } else {
        const diff = (sorted[i].timestamp - sorted[i - 1].timestamp) / 1000;
        totalSeconds += diff < 60 ? diff : 10;
      }
    }

    // Classificação
    let learning = 0;
    let review = 0;
    let relearning = 0;
    let correctCount = 0;
    let totalOld = 0;

    revisionsHoje.forEach(r => {
      // Usamos uma estimativa com base nos valores finais da revisão
      if (r.rating > 1) {
        correctCount++;
      }
      
      // Se o intervalo era maior que 0 antes da revisão (ou final > 1 dia)
      if (r.interval > 1) {
        totalOld++;
        if (r.rating === 1) {
          relearning++;
        } else {
          review++;
        }
      } else {
        learning++;
      }
    });

    return {
      count: revisionsHoje.length,
      minutes: parseFloat((totalSeconds / 60).toFixed(2)),
      sPerCard: parseFloat((totalSeconds / revisionsHoje.length).toFixed(2)),
      learning,
      review,
      relearning,
      filtered: 0,
      correctRate: totalOld > 0 ? Math.round((correctCount / revisionsHoje.length) * 100) : 100,
      correctCount,
      totalOld
    };
  }, [deckRevisions]);

  // --- 2. PREVISÃO ---
  const forecastData = useMemo(() => {
    const daysLimit = forecastHorizon === '1m' ? 30 : forecastHorizon === '3m' ? 90 : forecastHorizon === '1y' ? 365 : 730;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const counts: Record<string, number> = {};
    const datesList: string[] = [];

    for (let i = 0; i < daysLimit; i++) {
      const nextDate = new Date(today);
      nextDate.setDate(today.getDate() + i);
      const nextDateStr = nextDate.toISOString().split('T')[0];
      counts[nextDateStr] = 0;
      datesList.push(nextDateStr);
    }

    deckCards.forEach(card => {
      // Se dueDate for hoje ou no futuro e dentro do limite
      if (card.dueDate && card.dueDate >= todayStr) {
        if (counts[card.dueDate] !== undefined) {
          counts[card.dueDate]++;
        }
      }
    });

    let runningSum = 0;
    const data = datesList.map((dateStr) => {
      const count = counts[dateStr];
      runningSum += count;
      const formattedDate = dateStr.substring(8, 10) + '/' + dateStr.substring(5, 7);
      return {
        date: formattedDate,
        dateFull: dateStr,
        "Revisões": forecastAccumulated ? runningSum : count,
        rawCount: count
      };
    });

    const totalRevisions = deckCards.filter(c => c.dueDate >= todayStr && c.dueDate <= datesList[datesList.length - 1]).length;
    const average = parseFloat((totalRevisions / daysLimit).toFixed(1));
    const dueTomorrow = counts[datesList[1]] || 0;

    return {
      chartData: data,
      total: totalRevisions,
      avg: average,
      tomorrow: dueTomorrow
    };
  }, [deckCards, todayStr, forecastHorizon, forecastAccumulated]);

  // --- 3. CALENDÁRIO ---
  const calendarData = useMemo(() => {
    const yearRevisions = deckRevisions.filter(r => {
      const year = new Date(r.timestamp).getFullYear();
      return year === calendarYear;
    });

    const counts: Record<string, number> = {};
    yearRevisions.forEach(r => {
      const dateStr = getLocalDateStr(r.timestamp);
      counts[dateStr] = (counts[dateStr] || 0) + 1;
    });

    // Gerar todos os dias do ano selecionado
    const weeks: { days: ( { dateStr: string; dayOfMonth: number; count: number } | null )[] }[] = [];
    const firstDayOfYear = new Date(calendarYear, 0, 1);
    const lastDayOfYear = new Date(calendarYear, 12, 0); // 31 de Dezembro

    // Dia da semana do primeiro dia (0 = Domingo, 6 = Sábado)
    const startOffset = firstDayOfYear.getDay();

    let currentWeek: ( { dateStr: string; dayOfMonth: number; count: number } | null )[] = Array(startOffset).fill(null);

    const tempDate = new Date(firstDayOfYear);
    while (tempDate <= lastDayOfYear) {
      const dateStr = getLocalDateStr(tempDate.getTime());
      const dayOfWeek = tempDate.getDay();

      currentWeek.push({
        dateStr,
        dayOfMonth: tempDate.getDate(),
        count: counts[dateStr] || 0
      });

      if (dayOfWeek === 6 || tempDate.getTime() === lastDayOfYear.getTime()) {
        if (currentWeek.length < 7) {
          // Preencher o resto da última semana
          const fillSize = 7 - currentWeek.length;
          for (let i = 0; i < fillSize; i++) currentWeek.push(null);
        }
        weeks.push({ days: currentWeek });
        currentWeek = [];
      }

      tempDate.setDate(tempDate.getDate() + 1);
    }

    const totalDaysStudied = Object.keys(counts).length;
    const totalRevs = yearRevisions.length;

    return {
      weeks,
      totalDaysStudied,
      totalRevs
    };
  }, [deckRevisions, calendarYear]);

  // --- 4. REVISÕES (HISTÓRICO) ---
  const reviewsHistoryData = useMemo(() => {
    const limitDays = reviewsPeriod === '7d' ? 7 : reviewsPeriod === '1m' ? 30 : reviewsPeriod === '3m' ? 90 : 365;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const counts: Record<string, number> = {};
    const times: Record<string, number> = {};
    const datesList: string[] = [];

    for (let i = limitDays - 1; i >= 0; i--) {
      const prevDate = new Date(today);
      prevDate.setDate(today.getDate() - i);
      const prevDateStr = prevDate.toISOString().split('T')[0];
      counts[prevDateStr] = 0;
      times[prevDateStr] = 0;
      datesList.push(prevDateStr);
    }

    // Agrupar revisões do período
    const cutoffMs = today.getTime() - limitDays * 24 * 60 * 60 * 1000;
    const periodRevs = deckRevisions.filter(r => r.timestamp >= cutoffMs);

    // Calcular revisões por dia
    const revsByDay: Record<string, Revision[]> = {};
    periodRevs.forEach(r => {
      const dateStr = getLocalDateStr(r.timestamp);
      if (counts[dateStr] !== undefined) {
        counts[dateStr]++;
        if (!revsByDay[dateStr]) revsByDay[dateStr] = [];
        revsByDay[dateStr].push(r);
      }
    });

    // Calcular tempo por dia
    Object.keys(revsByDay).forEach(dateStr => {
      const dayRevs = [...revsByDay[dateStr]].sort((a, b) => a.timestamp - b.timestamp);
      let daySecs = 0;
      for (let i = 0; i < dayRevs.length; i++) {
        if (i === 0) {
          daySecs += 10;
        } else {
          const diff = (dayRevs[i].timestamp - dayRevs[i - 1].timestamp) / 1000;
          daySecs += diff < 60 ? diff : 10;
        }
      }
      times[dateStr] = parseFloat((daySecs / 60).toFixed(2));
    });

    const chartData = datesList.map(dateStr => {
      const formattedDate = dateStr.substring(8, 10) + '/' + dateStr.substring(5, 7);
      const dayRevs = revsByDay[dateStr] || [];
      const correctCount = dayRevs.filter(r => r.rating > 1).length;
      const totalCount = dayRevs.length;
      const accuracy = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : null;
      return {
        date: formattedDate,
        value: reviewsType === 'count' ? counts[dateStr] : times[dateStr],
        accuracy
      };
    });

    const studiedDaysCount = Object.keys(revsByDay).length;
    const totalRevs = periodRevs.length;
    const pctStudied = limitDays > 0 ? parseFloat(((studiedDaysCount / limitDays) * 100).toFixed(1)) : 0;
    const totalTime = Object.values(times).reduce((acc, curr) => acc + curr, 0);

    return {
      chartData,
      daysStudied: studiedDaysCount,
      totalDays: limitDays,
      pct: pctStudied,
      totalRevs,
      avgStudied: studiedDaysCount > 0 ? parseFloat((totalRevs / studiedDaysCount).toFixed(1)) : 0,
      avgAll: parseFloat((totalRevs / limitDays).toFixed(1)),
      totalTime: parseFloat(totalTime.toFixed(1))
    };
  }, [deckRevisions, reviewsPeriod, reviewsType]);

  // --- 5. CONTAGEM DE CARTÕES (PIE CHART) ---
  const cardsCountData = useMemo(() => {
    let newCount = 0;
    let learningCount = 0;
    let relearningCount = 0;
    let youngCount = 0;
    let matureCount = 0;

    deckCards.forEach(c => {
      if (c.interval === 0) {
        newCount++;
      } else if (c.interval >= 21) {
        matureCount++;
      } else {
        // Jovens/Recentes
        if (c.lapses > 0 && c.repetitions <= 1) {
          relearningCount++;
        } else if (c.repetitions <= 1) {
          learningCount++;
        } else {
          youngCount++;
        }
      }
    });

    const total = deckCards.length;
    const getPct = (count: number) => total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0;

    const data = [
      { name: 'Novos', value: newCount, color: '#3b82f6', pct: getPct(newCount) },
      { name: 'Aprendendo', value: learningCount, color: '#f97316', pct: getPct(learningCount) },
      { name: 'Reaprendendo', value: relearningCount, color: '#ef4444', pct: getPct(relearningCount) },
      { name: 'Recentes', value: youngCount, color: '#84cc16', pct: getPct(youngCount) },
      { name: 'Maduros', value: matureCount, color: '#10b981', pct: getPct(matureCount) },
    ];

    return {
      chartData: data.filter(d => d.value > 0),
      tableData: data,
      total
    };
  }, [deckCards]);

  // --- 6. INTERVALOS ---
  const intervalsData = useMemo(() => {
    const activeCards = deckCards.filter(c => c.interval > 0);
    
    // Bins: 1d, 2d, 3-5d, 6-10d, 11-20d, 21-50d, 51-100d, 101-200d, 201-500d, 500d+
    const bins = [
      { name: '1d', min: 1, max: 1, count: 0 },
      { name: '2d', min: 2, max: 2, count: 0 },
      { name: '3-5d', min: 3, max: 5, count: 0 },
      { name: '6-10d', min: 6, max: 10, count: 0 },
      { name: '11-20d', min: 11, max: 20, count: 0 },
      { name: '21-50d', min: 21, max: 50, count: 0 },
      { name: '51-100d', min: 51, max: 100, count: 0 },
      { name: '101-200d', min: 101, max: 200, count: 0 },
      { name: '201-500d', min: 201, max: 500, count: 0 },
      { name: '500d+', min: 501, max: 99999, count: 0 },
    ];

    activeCards.forEach(c => {
      const bin = bins.find(b => c.interval >= b.min && c.interval <= b.max);
      if (bin) bin.count++;
    });

    const sortedInts = activeCards.map(c => c.interval).sort((a, b) => a - b);
    let median = 0;
    if (sortedInts.length > 0) {
      const mid = Math.floor(sortedInts.length / 2);
      median = sortedInts.length % 2 !== 0 ? sortedInts[mid] : (sortedInts[mid - 1] + sortedInts[mid]) / 2;
    }

    return {
      chartData: bins,
      median: median > 30 ? (median / 30.4).toFixed(1) + ' meses' : median + ' dias'
    };
  }, [deckCards]);

  // --- 7. FACILIDADE (EASE) ---
  const easeData = useMemo(() => {
    // Fator de facilidade padrão é 2.5 (250%). Varia entre 1.3 (130%) e 3.0+
    const activeCards = deckCards.filter(c => easeScope === 'all' ? c.repetitions > 0 : c.interval >= 21);

    const bins = [
      { name: '<150%', min: 0, max: 1.49, count: 0 },
      { name: '150-180%', min: 1.5, max: 1.79, count: 0 },
      { name: '180-210%', min: 1.8, max: 2.09, count: 0 },
      { name: '210-240%', min: 2.1, max: 2.39, count: 0 },
      { name: '250%', min: 2.4, max: 2.55, count: 0 }, // Padrão
      { name: '260-280%', min: 2.56, max: 2.8, count: 0 },
      { name: '280%+', min: 2.81, max: 9.9, count: 0 }
    ];

    activeCards.forEach(c => {
      const bin = bins.find(b => c.ease >= b.min && c.ease <= b.max);
      if (bin) bin.count++;
    });

    const sortedEases = activeCards.map(c => c.ease).sort((a, b) => a - b);
    let median = 2.5;
    if (sortedEases.length > 0) {
      const mid = Math.floor(sortedEases.length / 2);
      median = sortedEases.length % 2 !== 0 ? sortedEases[mid] : (sortedEases[mid - 1] + sortedEases[mid]) / 2;
    }

    return {
      chartData: bins,
      median: Math.round(median * 100) + '%'
    };
  }, [deckCards, easeScope]);

  // --- 7.2. FSRS STATISTICS ---
  const fsrsData = useMemo(() => {
    const fsrsCards = deckCards.filter(c => c.difficulty !== undefined && c.stability !== undefined);
    if (fsrsCards.length === 0) {
      return {
        hasData: false,
        avgDifficulty: 0,
        avgStability: 0,
        difficultyChartData: [],
        stabilityChartData: []
      };
    }

    let totalDifficulty = 0;
    let totalStability = 0;

    // Bins for Difficulty: 1 to 10
    const difficultyBins = Array.from({ length: 10 }, (_, i) => ({
      name: `${i + 1}`,
      count: 0
    }));

    // Bins for Stability: < 1d, 1-5d, 5-15d, 15-30d, 30-90d, 90-365d, 365d+
    const stabilityBins = [
      { name: '< 1d', min: 0, max: 0.99, count: 0 },
      { name: '1-5d', min: 1, max: 5, count: 0 },
      { name: '5-15d', min: 5, max: 15, count: 0 },
      { name: '15-30d', min: 15, max: 30, count: 0 },
      { name: '30-90d', min: 30, max: 90, count: 0 },
      { name: '90-365d', min: 90, max: 365, count: 0 },
      { name: '365d+', min: 365, max: 99999, count: 0 }
    ];

    fsrsCards.forEach(c => {
      const d = c.difficulty!;
      const s = c.stability!;

      totalDifficulty += d;
      totalStability += s;

      // Difficulty bin (round or floor to nearest 1-10)
      const diffIndex = Math.max(0, Math.min(9, Math.round(d) - 1));
      difficultyBins[diffIndex].count++;

      // Stability bin
      const bin = stabilityBins.find(b => s >= b.min && s <= b.max);
      if (bin) {
        bin.count++;
      }
    });

    const avgDifficulty = parseFloat((totalDifficulty / fsrsCards.length).toFixed(2));
    const avgStability = parseFloat((totalStability / fsrsCards.length).toFixed(1));

    return {
      hasData: true,
      avgDifficulty,
      avgStability,
      difficultyChartData: difficultyBins,
      stabilityChartData: stabilityBins,
      totalCount: fsrsCards.length
    };
  }, [deckCards]);

  // --- 8. RETENÇÃO VERDADEIRA ---
  const trueRetentionData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkPeriod = (rev: Revision, daysAgo: number) => {
      const dateLimit = today.getTime() - daysAgo * 24 * 60 * 60 * 1000;
      return rev.timestamp >= dateLimit;
    };

    const getStatsForRange = (rangeName: string, filterFn: (rev: Revision) => boolean) => {
      const revs = deckRevisions.filter(filterFn);
      
      // Filtrar apenas revisões de cartões antigos (com intervalo final ou estimado >= 1 dia)
      const oldRevs = revs.filter(r => r.interval >= 1);
      
      let youngCorrect = 0, youngTotal = 0;
      let matureCorrect = 0, matureTotal = 0;

      oldRevs.forEach(r => {
        // Se após a revisão o intervalo for < 21 dias (revisão de cartão jovem)
        const isMature = r.interval >= 21;
        const isCorrect = r.rating > 1;

        if (isMature) {
          matureTotal++;
          if (isCorrect) matureCorrect++;
        } else {
          youngTotal++;
          if (isCorrect) youngCorrect++;
        }
      });

      const totalCorrect = youngCorrect + matureCorrect;
      const totalCount = youngTotal + matureTotal;

      const formatPct = (correct: number, total: number) => {
        return total > 0 ? `${((correct / total) * 100).toFixed(1)}%` : 'N/A';
      };

      return {
        name: rangeName,
        young: formatPct(youngCorrect, youngTotal),
        mature: formatPct(matureCorrect, matureTotal),
        total: formatPct(totalCorrect, totalCount),
        count: totalCount
      };
    };

    const ranges = [
      getStatsForRange('Hoje', r => r.timestamp >= today.getTime()),
      getStatsForRange('Ontem', r => r.timestamp >= today.getTime() - 24 * 60 * 60 * 1000 && r.timestamp < today.getTime()),
      getStatsForRange('Semana passada', r => checkPeriod(r, 7)),
      getStatsForRange('Mês passado', r => checkPeriod(r, 30)),
      getStatsForRange('Ano passado', r => checkPeriod(r, 365))
    ];

    return ranges;
  }, [deckRevisions]);

  // --- 9. DISTRIBUIÇÃO POR HORA ---
  const hourlyDistributionData = useMemo(() => {
    const limitDays = hourlyPeriod === '1m' ? 30 : hourlyPeriod === '3m' ? 90 : 365;
    const cutoff = Date.now() - limitDays * 24 * 60 * 60 * 1000;
    const periodRevs = deckRevisions.filter(r => r.timestamp >= cutoff);

    const counts = Array(24).fill(0);
    const correctCounts = Array(24).fill(0);

    periodRevs.forEach(r => {
      const hour = new Date(r.timestamp).getHours();
      counts[hour]++;
      if (r.rating > 1) {
        correctCounts[hour]++;
      }
    });

    const chartData = counts.map((count, hour) => {
      const successRate = count > 0 ? Math.round((correctCounts[hour] / count) * 100) : 0;
      return {
        hour: `${hour}h`,
        "Quantidade": count,
        "Aprovação (%)": successRate
      };
    });

    return chartData;
  }, [deckRevisions, hourlyPeriod]);

  // --- 10. BOTÕES DE RESPOSTA ---
  const buttonsData = useMemo(() => {
    const limitDays = buttonsPeriod === '1m' ? 30 : buttonsPeriod === '3m' ? 90 : 365;
    const cutoff = Date.now() - limitDays * 24 * 60 * 60 * 1000;
    const periodRevs = deckRevisions.filter(r => r.timestamp >= cutoff);

    // Botões no SM-2 do nosso app: 1 (Errei), 2 (Difícil), 3 (Fácil)
    // Vamos mapear contagem por botão e por tipo de cartão
    const counts = {
      learning: { 1: 0, 2: 0, 3: 0, 4: 0 },
      young: { 1: 0, 2: 0, 3: 0, 4: 0 },
      mature: { 1: 0, 2: 0, 3: 0, 4: 0 }
    };

    periodRevs.forEach(r => {
      const button = r.rating as 1 | 2 | 3;
      if (button >= 1 && button <= 3) {
        if (r.interval === 0) {
          counts.learning[button]++;
        } else if (r.interval >= 21) {
          counts.mature[button]++;
        } else {
          counts.young[button]++;
        }
      }
    });

    const data = [
      {
        name: 'Aprendendo',
        "Errei (1)": counts.learning[1],
        "Difícil (2)": counts.learning[2],
        "Fácil (3)": counts.learning[3],
      },
      {
        name: 'Recentes',
        "Errei (1)": counts.young[1],
        "Difícil (2)": counts.young[2],
        "Fácil (3)": counts.young[3],
      },
      {
        name: 'Maduros',
        "Errei (1)": counts.mature[1],
        "Difícil (2)": counts.mature[2],
        "Fácil (3)": counts.mature[3],
      }
    ];

    return data;
  }, [deckRevisions, buttonsPeriod]);

  // --- 11. ADICIONADO ---
  const addedCardsData = useMemo(() => {
    const limitDays = addedPeriod === '1m' ? 30 : addedPeriod === '3m' ? 90 : addedPeriod === '1y' ? 365 : 730;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const counts: Record<string, number> = {};
    const datesList: string[] = [];

    for (let i = limitDays - 1; i >= 0; i--) {
      const prevDate = new Date(today);
      prevDate.setDate(today.getDate() - i);
      const prevDateStr = prevDate.toISOString().split('T')[0];
      counts[prevDateStr] = 0;
      datesList.push(prevDateStr);
    }

    deckCards.forEach(c => {
      const dateStr = getLocalDateStr(c.createdAt);
      if (counts[dateStr] !== undefined) {
        counts[dateStr]++;
      }
    });

    let runningSum = 0;
    const chartData = datesList.map(dateStr => {
      const formattedDate = dateStr.substring(8, 10) + '/' + dateStr.substring(5, 7);
      const val = counts[dateStr];
      runningSum += val;
      return {
        date: formattedDate,
        "Criados": val,
        "Acumulado": runningSum
      };
    });

    const totalAdded = deckCards.filter(c => c.createdAt >= today.getTime() - limitDays * 24 * 60 * 60 * 1000).length;

    return {
      chartData,
      totalAdded
    };
  }, [deckCards, addedPeriod]);

  return (
    <div className="space-y-6 w-full max-w-5xl mx-auto px-2 pb-16">
      
      {/* CARD DE CABEÇALHO COM FILTROS GERAIS */}
      <ShadcnCard className="bg-card border-border p-5 rounded-2xl shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col gap-1 w-full md:w-auto">
          <h2 className="font-extrabold text-lg text-foreground tracking-tight flex items-center gap-2">
            📊 Estatísticas de Estudo
          </h2>
          <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider">
            Métricas de desempenho e histórico de revisões
          </p>
        </div>

        <div className="flex flex-row items-center gap-3 w-full md:w-auto justify-end">
          {/* Dropdown de Baralho */}
          <Select value={selectedScope} onValueChange={setSelectedScope}>
            <SelectTrigger className="bg-muted border-border text-foreground px-3 py-1.5 rounded-lg text-xs font-semibold w-auto h-8 focus:border-muted-foreground/45">
              <SelectValue placeholder="Coleção Inteira" />
            </SelectTrigger>
            <SelectContent className="rounded-xl border-border/50 shadow-xl max-h-[250px]">
              <SelectItem value="collection" className="rounded-lg cursor-pointer font-bold focus:bg-primary/10 focus:text-primary">Coleção Inteira</SelectItem>
              {decks.map(d => (
                <SelectItem key={d.id} value={d.id} className="rounded-lg cursor-pointer font-medium focus:bg-primary/10 focus:text-primary">{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Seletor de Período Geral */}
          <div className="flex border border-border rounded-lg overflow-hidden bg-muted/30">
            <Button
              variant="ghost"
              size="xs"
              className={`text-[10px] font-bold px-3.5 py-1.5 rounded-none cursor-pointer h-7 transition-all ${
                period === '12months' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setPeriod('12months')}
            >
              12 Meses
            </Button>
            <Button
              variant="ghost"
              size="xs"
              className={`text-[10px] font-bold px-3.5 py-1.5 rounded-none cursor-pointer h-7 transition-all ${
                period === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setPeriod('all')}
            >
              Histórico Completo
            </Button>
          </div>
          {/* Seletor de Algoritmo Visualizado */}
          <div className="flex border border-border rounded-lg overflow-hidden bg-muted/30">
            <Button
              variant="ghost"
              size="xs"
              className={`text-[10px] font-bold px-3 py-1.5 rounded-none cursor-pointer h-7 transition-all ${
                activeAlgoView === 'SM-2' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveAlgoView('SM-2')}
            >
              SM-2
            </Button>
            <Button
              variant="ghost"
              size="xs"
              className={`text-[10px] font-bold px-3 py-1.5 rounded-none cursor-pointer h-7 transition-all ${
                activeAlgoView === 'FSRS' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveAlgoView('FSRS')}
            >
              FSRS
            </Button>
          </div>
        </div>
      </ShadcnCard>

      {/* --- SEÇÃO 1: HOJE --- */}
      <ShadcnCard className="bg-card border-border p-6 rounded-2xl shadow-sm space-y-4">
        <h3 className="font-black text-sm text-foreground tracking-tight border-b border-border/50 pb-2"> Hoje </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="space-y-3">
            <div className="text-sm font-semibold text-foreground">
              Estudado(s) <span className="font-black text-primary text-base">{statsHoje.count}</span> cartões em <span className="font-black text-primary text-base">{statsHoje.minutes.toString().replace('.', ',')}</span> minutos hoje ({statsHoje.sPerCard.toString().replace('.', ',')}s/card)
            </div>
            
            <div className="space-y-1.5 text-xs font-semibold text-muted-foreground">
              <div>Contagem de repetições: {statsHoje.count} ({statsHoje.count > 0 ? '100' : '0'}%)</div>
              <div>Aprendidos: {statsHoje.learning}, Revisados: {statsHoje.review}, Reaprendidos: {statsHoje.relearning}, Filtrados: {statsHoje.filtered}</div>
              <div>Resposta correta de cartões antigos: {statsHoje.correctCount}/{statsHoje.count} ({statsHoje.correctRate}%)</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center bg-muted/15 p-4 rounded-xl border border-border/40">
            <div className="space-y-0.5">
              <div className="text-xl font-black text-blue-500">{statsHoje.learning}</div>
              <div className="text-[9px] uppercase font-bold text-muted-foreground">Aprendidos</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-xl font-black text-emerald-500">{statsHoje.review}</div>
              <div className="text-[9px] uppercase font-bold text-muted-foreground">Revisados</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-xl font-black text-red-500">{statsHoje.relearning}</div>
              <div className="text-[9px] uppercase font-bold text-muted-foreground">Lapsos</div>
            </div>
          </div>
        </div>
      </ShadcnCard>

      {/* --- SEÇÃO 2: PREVISÃO (FORECAST) --- */}
      <ShadcnCard className="bg-card border-border p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between border-b border-border/50 pb-2 gap-2">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-black text-sm text-foreground tracking-tight">Previsão</h3>
            <span className="text-[10px] text-muted-foreground font-medium">O número de revisões agendadas para o futuro.</span>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground cursor-pointer select-none">
              <input 
                type="checkbox" 
                className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-0 cursor-pointer"
                checked={forecastAccumulated}
                onChange={(e) => setForecastAccumulated(e.target.checked)}
              />
              Acumulado
            </label>

            <Select value={forecastHorizon} onValueChange={(val: any) => setForecastHorizon(val)}>
              <SelectTrigger className="bg-muted border-border text-foreground px-2 py-1 rounded text-[11px] font-bold w-[100px] h-7">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1m" className="text-[11px] font-bold cursor-pointer">1 Mês</SelectItem>
                <SelectItem value="3m" className="text-[11px] font-bold cursor-pointer">3 Meses</SelectItem>
                <SelectItem value="1y" className="text-[11px] font-bold cursor-pointer">1 Ano</SelectItem>
                <SelectItem value="all" className="text-[11px] font-bold cursor-pointer">Sempre</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="h-64 w-full">
          <ChartContainer config={{ "Revisões": { label: "Revisões", color: "#10b981" } }}>
            <BarChart data={forecastData.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} domain={[0, 'auto']} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="Revisões" fill="var(--color-Revisões)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>

        <div className="flex justify-around text-center text-xs font-bold text-muted-foreground/80 border-t border-border/40 pt-3">
          <div>Total: <span className="font-black text-foreground">{forecastData.total}</span> revisões</div>
          <div>Média: <span className="font-black text-foreground">{forecastData.avg}</span> revisões/dia</div>
          <div>A Revisar amanhã: <span className="font-black text-foreground">{forecastData.tomorrow}</span> revisões</div>
        </div>
      </ShadcnCard>

      {/* --- SEÇÃO 3: CALENDÁRIO --- */}
      <ShadcnCard className="bg-card border-border p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-black text-sm text-foreground tracking-tight">Calendário</h3>
            <span className="text-[10px] text-muted-foreground font-medium">Dias em que você estudou.</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="xs"
              className="h-7 w-7 rounded-lg p-0 font-bold"
              onClick={() => setCalendarYear(prev => prev - 1)}
            >
              ◄
            </Button>
            <span className="text-xs font-black text-foreground px-3">{calendarYear}</span>
            <Button
              variant="outline"
              size="xs"
              className="h-7 w-7 rounded-lg p-0 font-bold"
              onClick={() => setCalendarYear(prev => prev + 1)}
            >
              ►
            </Button>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="flex flex-row overflow-x-auto py-2 gap-1 max-w-full">
          <div className="flex flex-col justify-between text-[9px] font-bold text-muted-foreground pr-2 h-24 shrink-0 select-none">
            <span>D</span>
            <span>S</span>
            <span>T</span>
            <span>Q</span>
            <span>Q</span>
            <span>S</span>
            <span>S</span>
          </div>
          <div className="flex flex-row gap-1 select-none">
            {calendarData.weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1">
                {week.days.map((day, dIdx) => {
                  if (!day) return <div key={dIdx} className="w-3 h-3 rounded-[2px] bg-transparent" />;
                  
                  let colorClass = "bg-muted/30 border border-border/50";
                  if (day.count > 0 && day.count <= 5) colorClass = "bg-primary/20 border border-primary/10";
                  else if (day.count > 5 && day.count <= 15) colorClass = "bg-primary/45 border border-primary/20";
                  else if (day.count > 15) colorClass = "bg-primary text-primary-foreground border border-primary/30";

                  return (
                    <div 
                      key={dIdx} 
                      className={`w-3 h-3 rounded-[2px] cursor-pointer hover:border-foreground/50 transition-all ${colorClass}`}
                      title={`${day.dateStr}: ${day.count} revisões`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-around text-center text-xs font-bold text-muted-foreground/80 border-t border-border/40 pt-3">
          <div>Dias estudados: <span className="font-black text-foreground">{calendarData.totalDaysStudied}</span></div>
          <div>Total de revisões no ano: <span className="font-black text-foreground">{calendarData.totalRevs}</span></div>
        </div>
      </ShadcnCard>

      {/* --- SEÇÃO 4: REVISÕES (HISTÓRICO) --- */}
      <ShadcnCard className="bg-card border-border p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between border-b border-border/50 pb-2 gap-2">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-black text-sm text-foreground tracking-tight">Revisões</h3>
            <span className="text-[10px] text-muted-foreground font-medium">O número de questões que você já respondeu ou tempo gasto.</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex border border-border rounded-lg overflow-hidden bg-muted/30">
              <Button
                variant="ghost"
                size="xs"
                className={`text-[10px] font-bold px-2.5 py-1 rounded-none cursor-pointer h-7 transition-all ${
                  reviewsType === 'count' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
                onClick={() => setReviewsType('count')}
              >
                Quant.
              </Button>
              <Button
                variant="ghost"
                size="xs"
                className={`text-[10px] font-bold px-2.5 py-1 rounded-none cursor-pointer h-7 transition-all ${
                  reviewsType === 'time' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
                onClick={() => setReviewsType('time')}
              >
                Tempo
              </Button>
            </div>

            <Select value={reviewsPeriod} onValueChange={(val: any) => setReviewsPeriod(val)}>
              <SelectTrigger className="bg-muted border-border text-foreground px-2 py-1 rounded text-[11px] font-bold w-[100px] h-7">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d" className="text-[11px] font-bold cursor-pointer">7 Dias</SelectItem>
                <SelectItem value="1m" className="text-[11px] font-bold cursor-pointer">30 Dias</SelectItem>
                <SelectItem value="3m" className="text-[11px] font-bold cursor-pointer">90 Dias</SelectItem>
                <SelectItem value="1y" className="text-[11px] font-bold cursor-pointer">1 Ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="h-64 w-full">
          <ChartContainer 
            config={{ 
              value: { label: reviewsType === 'count' ? "Revisões" : "Minutos", color: "#3b82f6" },
              accuracy: { label: "Acurácia (%)", color: "#10b981" }
            }}
          >
            <ComposedChart data={reviewsHistoryData.chartData} margin={{ top: 10, right: 25, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis yAxisId="left" tickLine={false} axisLine={false} tickMargin={8} domain={[0, 'auto']} />
              <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tickMargin={8} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value: any, name: string) => (name === 'accuracy' || name === 'Acurácia (%)') ? `${value}%` : value} />} />
              <Bar yAxisId="left" dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="accuracy" stroke="var(--color-accuracy)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
            </ComposedChart>
          </ChartContainer>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-xs font-bold text-muted-foreground/80 border-t border-border/40 pt-4">
          <div>Dias estudados: <span className="font-black text-foreground">{reviewsHistoryData.daysStudied} de {reviewsHistoryData.totalDays} ({reviewsHistoryData.pct}%)</span></div>
          <div>Total: <span className="font-black text-foreground">{reviewsHistoryData.totalRevs} revisões</span></div>
          <div>Média geral: <span className="font-black text-foreground">{reviewsHistoryData.avgAll} revisões/dia</span></div>
          <div>Tempo Total: <span className="font-black text-foreground">{reviewsHistoryData.totalTime} min</span></div>
        </div>
      </ShadcnCard>

      {/* --- SEÇÃO 5: CONTAGEM DE CARTÕES --- */}
      <ShadcnCard className="bg-card border-border p-6 rounded-2xl shadow-sm space-y-4">
        <h3 className="font-black text-sm text-foreground tracking-tight border-b border-border/50 pb-2">Contagem de Cartões</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={cardsCountData.chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {cardsCountData.chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip formatter={(val, name, props) => [`${val} (${props.payload.pct}%)`, name]} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-black uppercase text-muted-foreground tracking-wider pb-1.5 border-b border-border/60">Lista de Tipos</div>
            <div className="divide-y divide-border/40 text-xs font-semibold text-foreground space-y-1">
              {cardsCountData.tableData.map(item => (
                <div key={item.name} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                    <span>{item.name}</span>
                  </div>
                  <div>
                    <span className="font-black">{item.value}</span>
                    <span className="text-muted-foreground/60 ml-2">({item.pct}%)</span>
                  </div>
                </div>
              ))}
              <div className="flex justify-between py-2 font-black border-t border-border/80">
                <span>Total de cartões</span>
                <span>{cardsCountData.total}</span>
              </div>
            </div>
          </div>
        </div>
      </ShadcnCard>

      {/* --- SEÇÃO 6: INTERVALOS E SEÇÃO 7: FACILIDADE / FSRS --- */}
      {activeAlgoView === 'FSRS' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* INTERVALOS */}
          <ShadcnCard className="bg-card border-border p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex flex-col gap-0.5">
                <h3 className="font-black text-sm text-foreground tracking-tight">Intervalos</h3>
                <span className="text-[10px] text-muted-foreground font-medium">Intervalos entre as revisões.</span>
              </div>
              <span className="text-xs font-black text-muted-foreground">Mediano: {intervalsData.median}</span>
            </div>

            <div className="h-56 w-full">
              <ChartContainer config={{ "count": { label: "Cartões", color: "#3b82f6" } }}>
                <BarChart data={intervalsData.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} domain={[0, 'auto']} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          </ShadcnCard>

          {/* DIFICULDADE FSRS */}
          <ShadcnCard className="bg-card border-border p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex flex-col gap-0.5">
                <h3 className="font-black text-sm text-foreground tracking-tight">Dificuldade FSRS</h3>
                <span className="text-[10px] text-muted-foreground font-medium">Dificuldade estimada (1 a 10).</span>
              </div>
              {fsrsData.hasData && (
                <span className="text-xs font-black text-muted-foreground">Média: {fsrsData.avgDifficulty}</span>
              )}
            </div>

            <div className="h-56 w-full flex items-center justify-center">
              {fsrsData.hasData ? (
                <ChartContainer config={{ "count": { label: "Cartões", color: "#8b5cf6" } }}>
                  <BarChart data={fsrsData.difficultyChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} domain={[0, 'auto']} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-4 gap-2 text-muted-foreground">
                  <Sparkles className="text-muted-foreground/45 animate-pulse" size={28} />
                  <span className="text-xs font-bold text-foreground">Sem dados FSRS</span>
                  <p className="text-[10px] max-w-[200px] leading-relaxed">
                    Estude seus cartões usando o algoritmo FSRS para visualizar a dificuldade.
                  </p>
                </div>
              )}
            </div>
          </ShadcnCard>

          {/* ESTABILIDADE FSRS */}
          <ShadcnCard className="bg-card border-border p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex flex-col gap-0.5">
                <h3 className="font-black text-sm text-foreground tracking-tight">Estabilidade FSRS</h3>
                <span className="text-[10px] text-muted-foreground font-medium">Durabilidade estimada em dias.</span>
              </div>
              {fsrsData.hasData && (
                <span className="text-xs font-black text-muted-foreground">Média: {fsrsData.avgStability}d</span>
              )}
            </div>

            <div className="h-56 w-full flex items-center justify-center">
              {fsrsData.hasData ? (
                <ChartContainer config={{ "count": { label: "Cartões", color: "#ec4899" } }}>
                  <BarChart data={fsrsData.stabilityChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} domain={[0, 'auto']} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-4 gap-2 text-muted-foreground">
                  <Sparkles className="text-muted-foreground/45 animate-pulse" size={28} />
                  <span className="text-xs font-bold text-foreground">Sem dados FSRS</span>
                  <p className="text-[10px] max-w-[200px] leading-relaxed">
                    Estude seus cartões usando o algoritmo FSRS para visualizar a estabilidade.
                  </p>
                </div>
              )}
            </div>
          </ShadcnCard>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* INTERVALOS */}
          <ShadcnCard className="bg-card border-border p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex flex-col gap-0.5">
                <h3 className="font-black text-sm text-foreground tracking-tight">Intervalos</h3>
                <span className="text-[10px] text-muted-foreground font-medium">Intervalos entre as revisões.</span>
              </div>
              <span className="text-xs font-black text-muted-foreground">Mediano: {intervalsData.median}</span>
            </div>

            <div className="h-56 w-full">
              <ChartContainer config={{ "count": { label: "Cartões", color: "#3b82f6" } }}>
                <BarChart data={intervalsData.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} domain={[0, 'auto']} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          </ShadcnCard>

          {/* FACILIDADE */}
          <ShadcnCard className="bg-card border-border p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <div className="flex flex-col gap-0.5">
                <h3 className="font-black text-sm text-foreground tracking-tight">Facilidade do Cartão</h3>
                <span className="text-[10px] text-muted-foreground font-medium">Fator de facilidade dos cartões estudados.</span>
              </div>
              <span className="text-xs font-black text-muted-foreground">Mediana: {easeData.median}</span>
            </div>

            <div className="h-56 w-full">
              <ChartContainer config={{ "count": { label: "Cartões", color: "#84cc16" } }}>
                <BarChart data={easeData.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={8} domain={[0, 'auto']} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          </ShadcnCard>
        </div>
      )}

      {/* --- SEÇÃO 8: RETENÇÃO VERDADEIRA --- */}
      <ShadcnCard className="bg-card border-border p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex flex-col gap-0.5 border-b border-border/50 pb-2">
          <h3 className="font-black text-sm text-foreground tracking-tight">Retenção Verdadeira</h3>
          <span className="text-[10px] text-muted-foreground font-medium">Taxa de aprovação de cartões com intervalo ≥ 1 dia (revisões acertadas vs erros).</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-border font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                <th className="py-2.5">Período</th>
                <th className="py-2.5">Recentes</th>
                <th className="py-2.5">Maduros</th>
                <th className="py-2.5">Total de cartões</th>
                <th className="py-2.5 text-right">Contagem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-semibold text-foreground">
              {trueRetentionData.map((row, idx) => (
                <tr key={idx} className="hover:bg-muted/10 transition-colors">
                  <td className="py-2.5 font-bold">{row.name}</td>
                  <td className="py-2.5 text-blue-500">{row.young}</td>
                  <td className="py-2.5 text-emerald-500">{row.mature}</td>
                  <td className="py-2.5 font-bold text-primary">{row.total}</td>
                  <td className="py-2.5 text-right text-muted-foreground">{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ShadcnCard>

      {/* --- SEÇÃO 9: DISTRIBUIÇÃO POR HORA --- */}
      <ShadcnCard className="bg-card border-border p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-black text-sm text-foreground tracking-tight">Distribuição por hora</h3>
            <span className="text-[10px] text-muted-foreground font-medium">Rever a taxa de sucesso para cada hora do dia.</span>
          </div>

          <Select value={hourlyPeriod} onValueChange={(val: any) => setHourlyPeriod(val)}>
            <SelectTrigger className="bg-muted border-border text-foreground px-2 py-1 rounded text-[11px] font-bold w-[90px] h-7">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m" className="text-[11px] font-bold cursor-pointer">1 Mês</SelectItem>
              <SelectItem value="3m" className="text-[11px] font-bold cursor-pointer">3 Meses</SelectItem>
              <SelectItem value="1y" className="text-[11px] font-bold cursor-pointer">1 Ano</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={hourlyDistributionData} margin={{ top: 10, right: 25, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="hour" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis yAxisId="left" tickLine={false} axisLine={false} tickMargin={8} domain={[0, 'auto']} />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(val) => `${val}%`} />
              <RechartsTooltip />
              <Bar yAxisId="left" dataKey="Quantidade" fill="#3b82f6" radius={[3, 3, 0, 0]} barSize={20} />
              <Line yAxisId="right" type="monotone" dataKey="Aprovação (%)" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ShadcnCard>

      {/* --- SEÇÃO 10: BOTÕES DE RESPOSTA --- */}
      <ShadcnCard className="bg-card border-border p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-black text-sm text-foreground tracking-tight">Botões de resposta</h3>
            <span className="text-[10px] text-muted-foreground font-medium">O número de vezes que você escolheu cada botão.</span>
          </div>

          <Select value={buttonsPeriod} onValueChange={(val: any) => setButtonsPeriod(val)}>
            <SelectTrigger className="bg-muted border-border text-foreground px-2 py-1 rounded text-[11px] font-bold w-[90px] h-7">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m" className="text-[11px] font-bold cursor-pointer">1 Mês</SelectItem>
              <SelectItem value="3m" className="text-[11px] font-bold cursor-pointer">3 Meses</SelectItem>
              <SelectItem value="1y" className="text-[11px] font-bold cursor-pointer">1 Ano</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="h-64 w-full">
          <ChartContainer config={{
            "Errei (1)": { label: "Errei (1)", color: "#ef4444" },
            "Difícil (2)": { label: "Difícil (2)", color: "#f97316" },
            "Fácil (3)": { label: "Fácil (3)", color: "#10b981" }
          }}>
            <BarChart data={buttonsData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} domain={[0, 'auto']} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="Errei (1)" fill="var(--color-Errei-1)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Difícil (2)" fill="var(--color-Difícil-2)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Fácil (3)" fill="var(--color-Fácil-3)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      </ShadcnCard>

      {/* --- SEÇÃO 11: ADICIONADO --- */}
      <ShadcnCard className="bg-card border-border p-6 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border/50 pb-2">
          <div className="flex flex-col gap-0.5">
            <h3 className="font-black text-sm text-foreground tracking-tight">Adicionado</h3>
            <span className="text-[10px] text-muted-foreground font-medium">O número de novos cartões que você adicionou.</span>
          </div>

          <Select value={addedPeriod} onValueChange={(val: any) => setAddedPeriod(val)}>
            <SelectTrigger className="bg-muted border-border text-foreground px-2 py-1 rounded text-[11px] font-bold w-[90px] h-7">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1m" className="text-[11px] font-bold cursor-pointer">1 Mês</SelectItem>
              <SelectItem value="3m" className="text-[11px] font-bold cursor-pointer">3 Meses</SelectItem>
              <SelectItem value="1y" className="text-[11px] font-bold cursor-pointer">1 Ano</SelectItem>
              <SelectItem value="all" className="text-[11px] font-bold cursor-pointer">Sempre</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="h-64 w-full">
          <ChartContainer config={{ "Criados": { label: "Criados", color: "#3b82f6" } }}>
            <BarChart data={addedCardsData.chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8} domain={[0, 'auto']} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="Criados" fill="var(--color-Criados)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>

        <div className="text-center text-xs font-bold text-muted-foreground/80 border-t border-border/40 pt-3">
          Total de cartões adicionados no período: <span className="font-black text-foreground">{addedCardsData.totalAdded}</span>
        </div>
      </ShadcnCard>

    </div>
  );
}
