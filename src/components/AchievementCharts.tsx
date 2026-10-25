import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { GradedStudentRecord, MultipleChoiceItem } from '../types';

interface CriterionStat {
  criterion: string;
  masteryPct: number;
  questionNums: number[];
}

interface AchievementChartsProps {
  gradedStudents: GradedStudentRecord[];
  quizQuestions: MultipleChoiceItem[];
  criterionStats: CriterionStat[];
  onUpdateStudent?: (id: string, patch: Partial<GradedStudentRecord>) => void;
}

type ChartTab = 'overview' | 'questions' | 'students';

const LETTERS = ['А', 'Б', 'В', 'Г'];

const LEVEL_COLORS: Record<string, string> = {
  'Маш сайн': '#16A34A',
  Хангалттай: '#EB6B26',
  'Дэмжлэг хэрэгтэй': '#DC2626',
};

const STUDENT_LINE_PALETTE = [
  '#EB6B26',
  '#0284C7',
  '#16A34A',
  '#7C3AED',
  '#D97706',
  '#0D9488',
  '#E11D48',
  '#4F46E5',
];

function getBarColor(pct: number): string {
  if (pct >= 75) return '#16A34A';
  if (pct >= 60) return '#EB6B26';
  return '#DC2626';
}

function getStatusLabel(pct: number): string {
  if (pct >= 75) return '● Сайн эзэмшсэн';
  if (pct >= 60) return '▲ Дундаж';
  return '■ Анхаарах';
}

export function resolveStudentStageScores(stu: GradedStudentRecord): {
  pre: number;
  concept: number;
  mid: number;
  final: number;
  delta: number;
} {
  const final = stu.percentage;
  const pre =
    typeof stu.preScorePct === 'number'
      ? Math.max(0, Math.min(100, Math.round(stu.preScorePct)))
      : Math.max(15, Math.min(85, final - 25));
  const mid =
    typeof stu.midScorePct === 'number'
      ? Math.max(0, Math.min(100, Math.round(stu.midScorePct)))
      : Math.round((pre + final) / 2);
  const concept = Math.round(pre + (mid - pre) * 0.55);
  return {
    pre,
    concept,
    mid,
    final,
    delta: final - pre,
  };
}

interface TooltipPayloadItem {
  name?: string;
  value?: number;
  color?: string;
  dataKey?: string;
  payload?: Record<string, unknown>;
}

const CustomChartTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  unit?: string;
}> = ({ active, payload, label, unit = '%' }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const rawPayload = item.payload || {};
  const subtitle = typeof rawPayload.subtitle === 'string' ? rawPayload.subtitle : null;
  const detail = typeof rawPayload.detail === 'string' ? rawPayload.detail : null;

  return (
    <div className="rounded-xl border border-[#DED8CE] bg-white px-3.5 py-2.5 shadow-sm text-xs">
      <div className="font-bold text-[#1C1917]">
        {label || (typeof rawPayload.fullName === 'string' ? rawPayload.fullName : item.name)}
      </div>
      {subtitle && <div className="text-[11px] text-[#78716C] mt-0.5">{subtitle}</div>}
      <div className="mt-1.5 font-mono tabular-nums font-bold text-[#D95D1E]">
        Үзүүлэлт: {item.value}
        {unit}
      </div>
      {detail && <div className="mt-0.5 text-[11px] text-[#57534E]">{detail}</div>}
    </div>
  );
};

const ProgressTrendTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;

  const sorted = [...payload].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div className="rounded-xl border border-[#DED8CE] bg-white px-3.5 py-2.5 shadow-sm text-xs min-w-[190px]">
      <div className="font-bold text-[#1C1917] pb-1.5 mb-1.5 border-b border-[#F0ECE4]">
        {label}
      </div>
      <div className="space-y-1">
        {sorted.map((entry) => (
          <div
            key={String(entry.dataKey || entry.name)}
            className="flex items-center justify-between gap-4"
          >
            <span className="text-[#44403C] truncate max-w-[140px]">
              <span
                style={{ color: entry.color || '#1C1917' }}
                className="font-bold mr-1.5"
              >
                ●
              </span>
              {entry.name}
            </span>
            <span className="font-mono tabular-nums font-bold text-[#1C1917] shrink-0">
              {entry.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AchievementCharts: React.FC<AchievementChartsProps> = ({
  gradedStudents,
  quizQuestions,
  criterionStats,
  onUpdateStudent,
}) => {
  const [activeChartTab, setActiveChartTab] = useState<ChartTab>('overview');
  const [selectedProgressStudentId, setSelectedProgressStudentId] =
    useState<string>('ALL');

  const activeFocusStudent = useMemo(
    () =>
      selectedProgressStudentId === 'ALL'
        ? null
        : gradedStudents.find((s) => s.id === selectedProgressStudentId) || null,
    [gradedStudents, selectedProgressStudentId]
  );

  const metrics = useMemo(() => {
    const total = gradedStudents.length;
    if (total === 0) {
      return {
        averagePct: 0,
        successRatePct: 0,
        qualityRatePct: 0,
        excellentCount: 0,
        proficientCount: 0,
        developingCount: 0,
      };
    }

    const sumPct = gradedStudents.reduce((acc, s) => acc + s.percentage, 0);
    const excellentCount = gradedStudents.filter((s) => s.rubricLevel === 'Маш сайн').length;
    const proficientCount = gradedStudents.filter((s) => s.rubricLevel === 'Хангалттай').length;
    const developingCount = gradedStudents.filter(
      (s) => s.rubricLevel === 'Дэмжлэг хэрэгтэй'
    ).length;

    const passedCount = excellentCount + proficientCount;

    return {
      averagePct: Math.round(sumPct / total),
      successRatePct: Math.round((passedCount / total) * 100),
      qualityRatePct: Math.round((excellentCount / total) * 100),
      excellentCount,
      proficientCount,
      developingCount,
    };
  }, [gradedStudents]);

  // Student Progress Trend Analytics across the 4 stages of the lesson
  const progressAnalytics = useMemo(() => {
    if (gradedStudents.length === 0) {
      return {
        trendData: [],
        avgPre: 0,
        avgMid: 0,
        avgFinal: 0,
        avgDelta: 0,
        improvedCount: 0,
        topImprover: null as { name: string; delta: number } | null,
        displayedStudents: [] as GradedStudentRecord[],
      };
    }

    const perStudent = gradedStudents.map((stu) => ({
      student: stu,
      stages: resolveStudentStageScores(stu),
    }));

    const count = perStudent.length;
    const avgPre = Math.round(
      perStudent.reduce((s, item) => s + item.stages.pre, 0) / count
    );
    const avgConcept = Math.round(
      perStudent.reduce((s, item) => s + item.stages.concept, 0) / count
    );
    const avgMid = Math.round(
      perStudent.reduce((s, item) => s + item.stages.mid, 0) / count
    );
    const avgFinal = Math.round(
      perStudent.reduce((s, item) => s + item.stages.final, 0) / count
    );

    const improvedCount = perStudent.filter((item) => item.stages.delta > 0).length;

    const sortedByGain = [...perStudent].sort(
      (a, b) => b.stages.delta - a.stages.delta
    );
    const best = sortedByGain[0];

    // Limit individual overlaid lines to 8 in 'ALL' view for visual clarity
    const displayedStudents = gradedStudents.slice(0, 8);

    const stageDefs: Array<{
      stageLabel: string;
      shortStage: string;
      key: 'pre' | 'concept' | 'mid' | 'final';
      avgVal: number;
    }> = [
      {
        stageLabel: '1. Гарааны оношилгоо (Эхлэл)',
        shortStage: '1. Гарааны үнэлгээ',
        key: 'pre',
        avgVal: avgPre,
      },
      {
        stageLabel: '2. Шинэ мэдлэг ба ойлголт',
        shortStage: '2. Шинэ мэдлэг',
        key: 'concept',
        avgVal: avgConcept,
      },
      {
        stageLabel: '3. Явцын дадлага ажил',
        shortStage: '3. Явцын үнэлгээ',
        key: 'mid',
        avgVal: avgMid,
      },
      {
        stageLabel: '4. Төгсгөлийн сорил (ZipGrade)',
        shortStage: '4. Төгсгөлийн сорил',
        key: 'final',
        avgVal: avgFinal,
      },
    ];

    const trendData = stageDefs.map((stDef) => {
      const point: Record<string, string | number> = {
        stage: stDef.shortStage,
        fullStage: stDef.stageLabel,
        classAvg: stDef.avgVal,
      };
      perStudent.forEach(({ student, stages }) => {
        point[student.id] = stages[stDef.key];
      });
      return point;
    });

    return {
      trendData,
      avgPre,
      avgMid,
      avgFinal,
      avgDelta: avgFinal - avgPre,
      improvedCount,
      topImprover: best
        ? { name: best.student.studentName, delta: best.stages.delta }
        : null,
      displayedStudents,
    };
  }, [gradedStudents]);

  const criterionChartData = useMemo(
    () =>
      criterionStats.map((c, idx) => ({
        shortName:
          c.criterion.length > 18 ? `${c.criterion.slice(0, 17)}…` : c.criterion,
        fullName: c.criterion,
        masteryPct: c.masteryPct,
        subtitle: `Асуулт №${c.questionNums.join(', №')}`,
        detail: getStatusLabel(c.masteryPct),
        index: idx + 1,
      })),
    [criterionStats]
  );

  const levelPieData = useMemo(() => {
    const total = Math.max(1, gradedStudents.length);
    return [
      {
        name: 'Маш сайн (80–100%)',
        shortLevel: 'Маш сайн',
        count: metrics.excellentCount,
        pct: Math.round((metrics.excellentCount / total) * 100),
        color: LEVEL_COLORS['Маш сайн'],
        detail: `${metrics.excellentCount} сурагч (${Math.round(
          (metrics.excellentCount / total) * 100
        )}%)`,
      },
      {
        name: 'Хангалттай (60–79%)',
        shortLevel: 'Хангалттай',
        count: metrics.proficientCount,
        pct: Math.round((metrics.proficientCount / total) * 100),
        color: LEVEL_COLORS['Хангалттай'],
        detail: `${metrics.proficientCount} сурагч (${Math.round(
          (metrics.proficientCount / total) * 100
        )}%)`,
      },
      {
        name: 'Дэмжлэг хэрэгтэй (<60%)',
        shortLevel: 'Дэмжлэг хэрэгтэй',
        count: metrics.developingCount,
        pct: Math.round((metrics.developingCount / total) * 100),
        color: LEVEL_COLORS['Дэмжлэг хэрэгтэй'],
        detail: `${metrics.developingCount} сурагч (${Math.round(
          (metrics.developingCount / total) * 100
        )}%)`,
      },
    ];
  }, [gradedStudents.length, metrics]);

  const questionItemData = useMemo(() => {
    const total = gradedStudents.length;
    return quizQuestions.map((q, qIdx) => {
      let right = 0;
      const optionCounts = [0, 0, 0, 0];
      gradedStudents.forEach((stu) => {
        const chosen = stu.selectedIndices[qIdx];
        if (chosen >= 0 && chosen < 4) {
          optionCounts[chosen] += 1;
        }
        if (chosen === q.correctIndex) {
          right += 1;
        }
      });
      const accuracyPct = total > 0 ? Math.round((right / total) * 100) : 0;
      const correctLetter = LETTERS[q.correctIndex] || 'А';
      return {
        label: `№${q.questionNumber}`,
        fullName: `Асуулт №${q.questionNumber}: ${q.question}`,
        accuracyPct,
        rightCount: right,
        wrongCount: Math.max(0, total - right),
        subtitle: `Зөв түлхүүр: ${correctLetter} · Зөв хариулсан: ${right}/${total}`,
        detail: `Сонголт: А(${optionCounts[0]}) · Б(${optionCounts[1]}) · В(${optionCounts[2]}) · Г(${optionCounts[3]})`,
      };
    });
  }, [gradedStudents, quizQuestions]);

  const studentChartData = useMemo(
    () =>
      [...gradedStudents]
        .sort((a, b) => b.percentage - a.percentage)
        .map((stu) => ({
          shortName:
            stu.studentName.length > 13
              ? `${stu.studentName.slice(0, 12)}…`
              : stu.studentName,
          fullName: `${stu.studentName} (${stu.studentCode})`,
          percentage: stu.percentage,
          rubricLevel: stu.rubricLevel,
          subtitle: `Зөв: ${stu.correctCount}/${stu.totalQuestions} · ${stu.source}`,
          detail: `Рубрик үнэлгээ: ${stu.rubricLevel}`,
        })),
    [gradedStudents]
  );

  const hardestQuestion = useMemo(() => {
    if (questionItemData.length === 0 || gradedStudents.length === 0) return null;
    return [...questionItemData].sort((a, b) => a.accuracyPct - b.accuracyPct)[0];
  }, [questionItemData, gradedStudents.length]);

  if (gradedStudents.length === 0) {
    return (
      <div className="py-8 px-4 rounded-xl border border-[#EAE4DC] bg-[#FAF8F5] text-center space-y-1.5">
        <div className="text-sm font-bold text-[#1C1917]">
          Хичээлийн амжилт ба сурагчийн ахиц дэвшлийн диаграмм хүлээгдэж байна
        </div>
        <p className="text-xs text-[#78716C] max-w-md mx-auto">
          Дээрх AI камер, ZipGrade CSV эсвэл шуурхай дугуйлагчаар сурагчдын дүнг оруулмагц ангийн амжилт болон «Сурагчийн ахиц дэвшил» чиг хандлагын диаграммууд автоматаар зурагдана.
        </p>
      </div>
    );
  }

  const focusStages = activeFocusStudent
    ? resolveStudentStageScores(activeFocusStudent)
    : null;

  return (
    <div className="space-y-6 pt-2">
      {/* SECTION 1: Student Progress Trend Diagram ("Сурагчийн ахиц дэвшил") */}
      <div className="rounded-xl border border-[#EAE4DC] bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F0ECE4]">
          <div>
            <div className="text-xs font-semibold text-[#78716C]">
              Чиг хандлагын шинжилгээ · Гарааны үнэлгээ → Явцын үнэлгээ → Төгсгөлийн сорил
            </div>
            <h4 className="mt-0.5 text-base font-bold text-[#1C1917]">
              Сурагчийн ахиц дэвшил
            </h4>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label
              htmlFor="progress-student-select"
              className="text-xs font-semibold text-[#57534E] whitespace-nowrap"
            >
              Сурагч:
            </label>
            <select
              id="progress-student-select"
              value={activeFocusStudent ? activeFocusStudent.id : 'ALL'}
              onChange={(e) => setSelectedProgressStudentId(e.target.value)}
              className="rounded-lg border border-[#DED8CE] bg-[#FCFBF9] px-3 py-1.5 text-xs font-semibold text-[#1C1917] focus:border-[#EB6B26] focus:outline-none max-w-[230px]"
            >
              <option value="ALL">
                Бүх сурагч + Ангийн дундаж ({gradedStudents.length})
              </option>
              {gradedStudents.map((stu) => {
                const stg = resolveStudentStageScores(stu);
                const sign = stg.delta >= 0 ? '+' : '';
                return (
                  <option key={stu.id} value={stu.id}>
                    {stu.studentName} ({sign}
                    {stg.delta}%)
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* Summary Progress Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#44403C] tabular-nums bg-[#FAF8F5] px-3.5 py-2.5 rounded-lg border border-[#EFECE6]">
          <div>
            <span className="text-[#78716C]">Ангийн дундаж өөрчлөлт: </span>
            <strong className="font-mono text-[#1C1917]">
              {progressAnalytics.avgPre}% → {progressAnalytics.avgMid}% →{' '}
              {progressAnalytics.avgFinal}%
            </strong>
            <span
              className={`ml-1.5 font-mono font-bold ${
                progressAnalytics.avgDelta >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
              }`}
            >
              ({progressAnalytics.avgDelta >= 0 ? '+' : ''}
              {progressAnalytics.avgDelta}%)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span>
              Ахисан сурагч:{' '}
              <strong className="font-mono text-[#16A34A]">
                {progressAnalytics.improvedCount}/{gradedStudents.length}
              </strong>
            </span>
            {progressAnalytics.topImprover && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  Хамгийн өндөр ахиц:{' '}
                  <strong className="text-[#1C1917]">
                    {progressAnalytics.topImprover.name}
                  </strong>{' '}
                  <span className="font-mono font-bold text-[#D95D1E]">
                    ({progressAnalytics.topImprover.delta >= 0 ? '+' : ''}
                    {progressAnalytics.topImprover.delta}%)
                  </span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Multi-Line / Focused Student Progress LineChart */}
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={progressAnalytics.trendData}
              margin={{ top: 12, right: 20, left: -10, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#EFECE6" vertical={false} />
              <XAxis
                dataKey="stage"
                tick={{ fill: '#44403C', fontSize: 11 }}
                axisLine={{ stroke: '#DED8CE' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: '#78716C', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ProgressTrendTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                iconType="plainline"
              />
              <ReferenceLine
                y={60}
                stroke="#D6CEC2"
                strokeDasharray="3 3"
                label={{
                  value: 'Хангалттай босго 60%',
                  position: 'insideBottomRight',
                  fill: '#78716C',
                  fontSize: 10,
                }}
              />

              {/* Class Average Trend Line */}
              <Line
                type="monotone"
                dataKey="classAvg"
                name="Ангийн дундаж"
                stroke="#1C1917"
                strokeWidth={activeFocusStudent ? 2 : 3}
                strokeDasharray={activeFocusStudent ? '5 4' : undefined}
                dot={{ r: 4, fill: '#1C1917', strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />

              {/* Either Single Focused Student OR All Displayed Students */}
              {activeFocusStudent ? (
                <Line
                  type="monotone"
                  dataKey={activeFocusStudent.id}
                  name={activeFocusStudent.studentName}
                  stroke="#EB6B26"
                  strokeWidth={3.5}
                  dot={{ r: 5, fill: '#EB6B26', stroke: '#FFFFFF', strokeWidth: 2 }}
                  activeDot={{ r: 7 }}
                />
              ) : (
                progressAnalytics.displayedStudents.map((stu, idx) => (
                  <Line
                    key={stu.id}
                    type="monotone"
                    dataKey={stu.id}
                    name={stu.studentName}
                    stroke={STUDENT_LINE_PALETTE[idx % STUDENT_LINE_PALETTE.length]}
                    strokeWidth={2}
                    dot={{
                      r: 3.5,
                      fill: STUDENT_LINE_PALETTE[idx % STUDENT_LINE_PALETTE.length],
                      strokeWidth: 0,
                    }}
                    activeDot={{ r: 5.5 }}
                  />
                ))
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Interactive Stage Score Editor when a specific student is selected */}
        {activeFocusStudent && focusStages && onUpdateStudent && (
          <div className="pt-3 border-t border-[#F0ECE4] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="text-[#44403C]">
              <strong>{activeFocusStudent.studentName}</strong> — Хичээлийн үе шатны оноог засах:
            </div>
            <div className="flex flex-wrap items-center gap-3 tabular-nums">
              <label className="inline-flex items-center gap-1.5 text-[#57534E]">
                <span>Гарааны (%):</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={focusStages.pre}
                  onChange={(e) =>
                    onUpdateStudent(activeFocusStudent.id, {
                      preScorePct: Math.max(
                        0,
                        Math.min(100, Number(e.target.value) || 0)
                      ),
                    })
                  }
                  className="w-16 rounded-lg border border-[#DED8CE] bg-[#FCFBF9] px-2 py-1 font-mono text-xs font-bold text-[#1C1917] focus:border-[#EB6B26] focus:outline-none"
                />
              </label>

              <label className="inline-flex items-center gap-1.5 text-[#57534E]">
                <span>Явцын (%):</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={focusStages.mid}
                  onChange={(e) =>
                    onUpdateStudent(activeFocusStudent.id, {
                      midScorePct: Math.max(
                        0,
                        Math.min(100, Number(e.target.value) || 0)
                      ),
                    })
                  }
                  className="w-16 rounded-lg border border-[#DED8CE] bg-[#FCFBF9] px-2 py-1 font-mono text-xs font-bold text-[#1C1917] focus:border-[#EB6B26] focus:outline-none"
                />
              </label>

              <span className="text-[#57534E]">
                Төгсгөлийн сорил:{' '}
                <strong className="font-mono text-[#1C1917]">{focusStages.final}%</strong>
              </span>

              <span
                className={`font-mono font-bold ${
                  focusStages.delta >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                }`}
              >
                Нийт өсөлт: {focusStages.delta >= 0 ? '+' : ''}
                {focusStages.delta}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: Lesson Achievement & Item Analysis Charts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div>
          <h4 className="text-base font-bold text-[#1C1917]">
            Хичээлийн амжилт ба үнэлгээний диаграмм
          </h4>
          <p className="text-xs text-[#78716C] tabular-nums">
            Нийт {gradedStudents.length} сурагчийн төгсгөлийн сорилын гүйцэтгэлийн задаргаа
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#EFECE5] w-fit">
          <button
            type="button"
            onClick={() => setActiveChartTab('overview')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeChartTab === 'overview'
                ? 'bg-white text-[#1C1917] shadow-xs'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Шалгуур ба Түвшин
          </button>
          <button
            type="button"
            onClick={() => setActiveChartTab('questions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeChartTab === 'questions'
                ? 'bg-white text-[#1C1917] shadow-xs'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Даалгаврын шинжилгээ
          </button>
          <button
            type="button"
            onClick={() => setActiveChartTab('students')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeChartTab === 'students'
                ? 'bg-white text-[#1C1917] shadow-xs'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            Сурагчдын оноо
          </button>
        </div>
      </div>

      {/* Mongolian School Core KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#EAE4DC] border border-[#EAE4DC] rounded-xl bg-[#FCFBF9]">
        <div className="p-3.5 sm:p-4">
          <div className="text-xs text-[#78716C]">Ангийн дундаж гүйцэтгэл</div>
          <div className="mt-1 font-mono tabular-nums text-2xl font-bold text-[#1C1917]">
            {metrics.averagePct}%
          </div>
          <div className="mt-0.5 text-[11px] text-[#57534E] tabular-nums">
            Гараанаас {progressAnalytics.avgDelta >= 0 ? '+' : ''}
            {progressAnalytics.avgDelta}% өссөн
          </div>
        </div>

        <div className="p-3.5 sm:p-4">
          <div className="text-xs text-[#78716C]">Сургалтын амжилт (≥60%)</div>
          <div className="mt-1 font-mono tabular-nums text-2xl font-bold text-[#16A34A]">
            {metrics.successRatePct}%
          </div>
          <div className="mt-0.5 text-[11px] text-[#57534E] tabular-nums">
            {metrics.excellentCount + metrics.proficientCount}/{gradedStudents.length} сурагч хангасан
          </div>
        </div>

        <div className="p-3.5 sm:p-4">
          <div className="text-xs text-[#78716C]">Сургалтын чанар (≥80%)</div>
          <div className="mt-1 font-mono tabular-nums text-2xl font-bold text-[#D95D1E]">
            {metrics.qualityRatePct}%
          </div>
          <div className="mt-0.5 text-[11px] text-[#57534E] tabular-nums">
            Маш сайн: {metrics.excellentCount} сурагч
          </div>
        </div>

        <div className="p-3.5 sm:p-4">
          <div className="text-xs text-[#78716C]">Хамгийн их алдсан даалгавар</div>
          <div className="mt-1 font-mono tabular-nums text-2xl font-bold text-[#DC2626]">
            {hardestQuestion ? `${hardestQuestion.label} (${hardestQuestion.accuracyPct}%)` : '—'}
          </div>
          <div className="mt-0.5 text-[11px] text-[#57534E] truncate">
            {hardestQuestion
              ? `Зөв хариулсан: ${hardestQuestion.rightCount}/${gradedStudents.length}`
              : 'Мэдээлэл байхгүй'}
          </div>
        </div>
      </div>

      {/* Tab 1: Overview — Rubric Criterion BarChart + Rubric Level Donut Chart */}
      {activeChartTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          <div className="lg:col-span-7 rounded-xl border border-[#EAE4DC] bg-white p-4 sm:p-5 flex flex-col justify-between">
            <div className="mb-3 flex items-baseline justify-between gap-2">
              <div>
                <h5 className="text-sm font-bold text-[#1C1917]">
                  Рубрикийн шалгуур тус бүрийн эзэмшилт (%)
                </h5>
                <p className="text-xs text-[#78716C]">
                  Тасархай шугам: зорилтот 75%-ийн босго үзүүлэлт
                </p>
              </div>
              <span className="text-xs text-[#57534E] tabular-nums whitespace-nowrap">
                ● ≥75% · ▲ 60–74% · ■ &lt;60%
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={criterionChartData}
                  margin={{ top: 10, right: 16, left: -12, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFECE6" vertical={false} />
                  <XAxis
                    dataKey="shortName"
                    tick={{ fill: '#57534E', fontSize: 11 }}
                    axisLine={{ stroke: '#DED8CE' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                    tick={{ fill: '#78716C', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomChartTooltip unit="%" />} cursor={{ fill: '#FAF8F5' }} />
                  <ReferenceLine
                    y={75}
                    stroke="#78716C"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Зорилт 75%',
                      position: 'insideTopRight',
                      fill: '#78716C',
                      fontSize: 10,
                    }}
                  />
                  <Bar dataKey="masteryPct" radius={[6, 6, 0, 0]} maxBarSize={48}>
                    {criterionChartData.map((entry) => (
                      <Cell key={entry.fullName} fill={getBarColor(entry.masteryPct)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl border border-[#EAE4DC] bg-white p-4 sm:p-5 flex flex-col justify-between">
            <div>
              <h5 className="text-sm font-bold text-[#1C1917]">
                Рубрикийн түвшний эзлэх хувь
              </h5>
              <p className="text-xs text-[#78716C]">
                Сурагчдын гүйцэтгэлийн түвшний бүтэц
              </p>
            </div>

            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={levelPieData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={76}
                    paddingAngle={3}
                  >
                    {levelPieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} stroke="#FFFFFF" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomChartTooltip unit=" сурагч" />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-[#F0ECE4] text-xs">
              {levelPieData.map((lvl, idx) => {
                const glyph = idx === 0 ? '●' : idx === 1 ? '▲' : '■';
                return (
                  <div
                    key={lvl.name}
                    className="flex items-center justify-between gap-2 text-[#44403C]"
                  >
                    <span className="truncate">
                      <span style={{ color: lvl.color }} className="mr-1.5 font-bold">
                        {glyph}
                      </span>
                      {lvl.name}
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-[#1C1917] shrink-0">
                      {lvl.count} ({lvl.pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Per-Question Item Analysis BarChart */}
      {activeChartTab === 'questions' && (
        <div className="rounded-xl border border-[#EAE4DC] bg-white p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h5 className="text-sm font-bold text-[#1C1917]">
                Даалгавар тус бүрийн зөв гүйцэтгэлийн хувь (Item Analysis)
              </h5>
              <p className="text-xs text-[#78716C]">
                Багана дээр хулганаа аваачиж А, Б, В, Г хувилбар тус бүрийг хэдэн сурагч сонгосныг харна уу
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-[#57534E]">
              Дундаж: {metrics.averagePct}%
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={questionItemData}
                margin={{ top: 10, right: 16, left: -12, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#EFECE6" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#1C1917', fontSize: 12, fontFamily: 'IBM Plex Mono' }}
                  axisLine={{ stroke: '#DED8CE' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: '#78716C', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomChartTooltip unit="%" />} cursor={{ fill: '#FAF8F5' }} />
                <ReferenceLine
                  y={metrics.averagePct}
                  stroke="#EB6B26"
                  strokeDasharray="4 4"
                  label={{
                    value: `Дундаж ${metrics.averagePct}%`,
                    position: 'insideTopRight',
                    fill: '#D95D1E',
                    fontSize: 10,
                  }}
                />
                <Bar dataKey="accuracyPct" radius={[6, 6, 0, 0]} maxBarSize={52}>
                  {questionItemData.map((entry) => (
                    <Cell key={entry.label} fill={getBarColor(entry.accuracyPct)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tab 3: Student Score Comparison BarChart */}
      {activeChartTab === 'students' && (
        <div className="rounded-xl border border-[#EAE4DC] bg-white p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h5 className="text-sm font-bold text-[#1C1917]">
                Сурагч тус бүрийн онооны харьцуулалт (%)
              </h5>
              <p className="text-xs text-[#78716C]">
                Өндөр оноотойгоос эрэмбэлсэн жагсаалт болон ангийн дундаж шугам
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-[#57534E]">
              Ангийн дундаж: {metrics.averagePct}%
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={studentChartData}
                margin={{ top: 10, right: 16, left: -12, bottom: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#EFECE6" vertical={false} />
                <XAxis
                  dataKey="shortName"
                  tick={{ fill: '#44403C', fontSize: 11 }}
                  axisLine={{ stroke: '#DED8CE' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: '#78716C', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomChartTooltip unit="%" />} cursor={{ fill: '#FAF8F5' }} />
                <ReferenceLine
                  y={metrics.averagePct}
                  stroke="#1C1917"
                  strokeDasharray="4 4"
                  label={{
                    value: `Дундаж ${metrics.averagePct}%`,
                    position: 'insideTopRight',
                    fill: '#1C1917',
                    fontSize: 10,
                  }}
                />
                <Bar dataKey="percentage" radius={[6, 6, 0, 0]} maxBarSize={44}>
                  {studentChartData.map((entry) => (
                    <Cell
                      key={entry.fullName}
                      fill={LEVEL_COLORS[entry.rubricLevel] || '#EB6B26'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
