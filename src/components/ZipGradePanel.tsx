import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  GradedStudentRecord,
  LessonGoal,
  MultipleChoiceItem,
  RubricRow,
} from '../types';
import {
  downloadBubbleSheetWord,
  downloadGradebookCsv,
} from '../utils/exportLessonPlan';
import {
  AchievementCharts,
  resolveStudentStageScores,
} from './AchievementCharts';

interface ZipGradePanelProps {
  goal: LessonGoal;
  quizQuestions: MultipleChoiceItem[];
  rubricRows: RubricRow[];
  gradedStudents: GradedStudentRecord[];
  onAddStudents: (records: GradedStudentRecord[]) => void;
  onUpdateStudent: (id: string, patch: Partial<GradedStudentRecord>) => void;
  onRemoveStudent: (id: string) => void;
  onClearAllStudents: () => void;
}

type EntryMode = 'camera' | 'csv' | 'manual';

const LETTERS = ['А', 'Б', 'В', 'Г'];

function parseChoiceToken(token: string): number {
  const clean = token.trim().toUpperCase();
  if (!clean) return -1;
  if (clean === 'A' || clean === 'А' || clean === '1') return 0;
  if (clean === 'B' || clean === 'Б' || clean === '2') return 1;
  if (clean === 'C' || clean === 'В' || clean === '3') return 2;
  if (clean === 'D' || clean === 'Г' || clean === '4') return 3;
  return -1;
}

function computeRubricLevel(
  percentage: number
): 'Маш сайн' | 'Хангалттай' | 'Дэмжлэг хэрэгтэй' {
  if (percentage >= 80) return 'Маш сайн';
  if (percentage >= 60) return 'Хангалттай';
  return 'Дэмжлэг хэрэгтэй';
}

export const ZipGradePanel: React.FC<ZipGradePanelProps> = ({
  goal,
  quizQuestions,
  rubricRows,
  gradedStudents,
  onAddStudents,
  onUpdateStudent,
  onRemoveStudent,
  onClearAllStudents,
}) => {
  const [entryMode, setEntryMode] = useState<EntryMode>('camera');

  // Map each questionNumber -> Rubric Criterion name
  const [questionRubricMap, setQuestionRubricMap] = useState<Record<number, string>>({});

  // Manual Quick Bubble Entry State
  const [manualName, setManualName] = useState<string>('');
  const [manualCode, setManualCode] = useState<string>('');
  const [manualPreScore, setManualPreScore] = useState<string>('');
  const [manualMidScore, setManualMidScore] = useState<string>('');
  const [manualChoices, setManualChoices] = useState<number[]>([]);

  // AI Camera Scan State
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scannedPreviewUrl, setScannedPreviewUrl] = useState<string | null>(null);

  // CSV Import State
  const [csvFeedback, setCsvFeedback] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const nextMap: Record<number, string> = {};
    quizQuestions.forEach((q, idx) => {
      const defaultCrit =
        rubricRows.length > 0
          ? rubricRows[idx % rubricRows.length].criterion
          : 'Ерөнхий ойлголт';
      nextMap[q.questionNumber] = defaultCrit;
    });
    setQuestionRubricMap(nextMap);
    setManualChoices(new Array(quizQuestions.length).fill(-1));
  }, [quizQuestions, rubricRows]);

  const buildGradedRecord = (
    name: string,
    code: string,
    selectedIndices: number[],
    source: GradedStudentRecord['source'],
    explicitPrePct?: number,
    explicitMidPct?: number
  ): GradedStudentRecord => {
    const normalized = quizQuestions.map((_, idx) =>
      typeof selectedIndices[idx] === 'number' ? selectedIndices[idx] : -1
    );
    let correctCount = 0;
    quizQuestions.forEach((q, idx) => {
      if (normalized[idx] === q.correctIndex) {
        correctCount += 1;
      }
    });
    const total = Math.max(1, quizQuestions.length);
    const percentage = Math.round((correctCount / total) * 100);

    const defaultPre = Math.max(15, Math.min(85, percentage - 25));
    const preScorePct =
      typeof explicitPrePct === 'number' && !Number.isNaN(explicitPrePct)
        ? Math.max(0, Math.min(100, Math.round(explicitPrePct)))
        : defaultPre;
    const midScorePct =
      typeof explicitMidPct === 'number' && !Number.isNaN(explicitMidPct)
        ? Math.max(0, Math.min(100, Math.round(explicitMidPct)))
        : Math.round((preScorePct + percentage) / 2);

    return {
      id: `st-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      studentName: name.trim() || 'Нэргүй сурагч',
      studentCode: code.trim() || `№${gradedStudents.length + 1}`,
      selectedIndices: normalized,
      correctCount,
      totalQuestions: quizQuestions.length,
      preScorePct,
      midScorePct,
      percentage,
      rubricLevel: computeRubricLevel(percentage),
      source,
    };
  };

  // 1. AI Photo / ZipGrade Sheet Optical Scan Handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanError(null);
    setScanMessage(null);
    setIsScanning(true);

    const previewUrl = URL.createObjectURL(file);
    setScannedPreviewUrl(previewUrl);

    try {
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const resultStr = String(reader.result || '');
          const commaIdx = resultStr.indexOf(',');
          resolve(commaIdx >= 0 ? resultStr.slice(commaIdx + 1) : resultStr);
        };
        reader.onerror = () => reject(new Error('Зураг уншиж чадсангүй.'));
        reader.readAsDataURL(file);
      });

      const response = await fetch('/api/autograde/scan-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: file.type || 'image/jpeg',
          questionCount: quizQuestions.length,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Зураг танихад алдаа гарлаа.');
      }

      const detectedIndices: number[] = Array.isArray(data.selectedIndices)
        ? data.selectedIndices
        : [];
      const detectedName =
        (data.studentName || '').trim() || `Сурагч #${gradedStudents.length + 1}`;
      const detectedCode = (data.studentCode || '').trim() || '';

      const record = buildGradedRecord(
        detectedName,
        detectedCode,
        detectedIndices,
        'AI Зураг уншигч'
      );
      onAddStudents([record]);
      setScanMessage(
        `Амжилттай заслаа: ${record.studentName} — ${record.correctCount}/${record.totalQuestions} (${record.percentage}%, ${record.rubricLevel}). ${data.scanNote || ''}`
      );
    } catch (err: unknown) {
      setScanError(
        err instanceof Error ? err.message : 'Зургаас хариулт уншихад алдаа гарлаа.'
      );
    } finally {
      setIsScanning(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  // 2. ZipGrade / Excel CSV Batch Parser
  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFeedback(null);
    try {
      const text = await file.text();
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        setCsvFeedback('CSV файлд сурагчийн мөр олдсонгүй.');
        return;
      }

      const splitCsvLine = (line: string): string[] =>
        line
          .split(',')
          .map((cell) => cell.replace(/^"|"$/g, '').trim());

      const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());

      // Detect ZipGrade columns (Stu1, Stu2... or Q1, Q2... or Асуулт 1...)
      const answerColIndices: number[] = [];
      quizQuestions.forEach((q, idx) => {
        const qNum = q.questionNumber || idx + 1;
        const foundCol = headers.findIndex(
          (h) =>
            h === `stu${qNum}` ||
            h === `q${qNum}` ||
            h === `асуулт ${qNum}` ||
            h === `асуулт${qNum}` ||
            h === `${qNum}`
        );
        if (foundCol >= 0) answerColIndices.push(foundCol);
      });

      const firstNameCol = headers.findIndex(
        (h) =>
          h.includes('нэр') ||
          h.includes('first name') ||
          h.includes('student') ||
          h === 'name'
      );
      const lastNameCol = headers.findIndex((h) => h.includes('last name') || h.includes('овог'));
      const codeCol = headers.findIndex(
        (h) => h.includes('id') || h.includes('код') || h.includes('дугаар')
      );

      const preCol = headers.findIndex(
        (h) => h.includes('гараа') || h.includes('pre')
      );
      const midCol = headers.findIndex(
        (h) => h.includes('явц') || h.includes('mid')
      );

      const imported: GradedStudentRecord[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = splitCsvLine(lines[i]);
        if (cols.length < 2) continue;

        const namePart =
          firstNameCol >= 0
            ? `${lastNameCol >= 0 ? cols[lastNameCol] + ' ' : ''}${cols[firstNameCol]}`.trim()
            : cols[1] || `Сурагч ${i}`;
        const codePart = codeCol >= 0 ? cols[codeCol] : cols[0] || `№${i}`;

        const answers = quizQuestions.map((_, qIdx) => {
          const colIdx =
            answerColIndices[qIdx] !== undefined ? answerColIndices[qIdx] : qIdx + 2;
          return parseChoiceToken(cols[colIdx] || '');
        });

        const parsedPre =
          preCol >= 0 && cols[preCol]
            ? parseFloat(cols[preCol].replace('%', ''))
            : undefined;
        const parsedMid =
          midCol >= 0 && cols[midCol]
            ? parseFloat(cols[midCol].replace('%', ''))
            : undefined;

        imported.push(
          buildGradedRecord(
            namePart,
            codePart,
            answers,
            'ZipGrade CSV',
            parsedPre,
            parsedMid
          )
        );
      }

      if (imported.length > 0) {
        onAddStudents(imported);
        setCsvFeedback(`ZipGrade / CSV файлаас нийт ${imported.length} сурагчийн тестийг рубрик ба ахиц дэвшлээр автоматаар засаж орууллаа.`);
      } else {
        setCsvFeedback('Тохирох сурагчийн хариулт олдсонгүй. Загвар CSV файлыг харна уу.');
      }
    } catch {
      setCsvFeedback('CSV файл унших үед алдаа гарлаа.');
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const handleDownloadSampleZipGradeTemplate = () => {
    const qHeaders = quizQuestions.map((q) => `Stu${q.questionNumber}`).join(',');
    const sampleRow1 = [
      '8A-101',
      'Бат-Эрдэнэ',
      ...quizQuestions.map((q) => LETTERS[q.correctIndex] || 'А'),
      '55',
      '80',
    ].join(',');
    const sampleRow2 = [
      '8A-102',
      'Сарангэрэл',
      ...quizQuestions.map((q, idx) =>
        idx === 0 ? 'А' : LETTERS[q.correctIndex] || 'Б'
      ),
      '40',
      '65',
    ].join(',');

    const content = `ZipGrade ID,Сурагчийн нэр,${qHeaders},Гарааны %,Явцын %\r\n${sampleRow1}\r\n${sampleRow2}`;
    const blob = new Blob(['\ufeff', content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AI-87_ZipGrade_Загвар.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 3. Manual Quick Bubble Clicker Submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedPre =
      manualPreScore.trim() !== '' ? Number(manualPreScore) : undefined;
    const parsedMid =
      manualMidScore.trim() !== '' ? Number(manualMidScore) : undefined;

    const record = buildGradedRecord(
      manualName || `Сурагч #${gradedStudents.length + 1}`,
      manualCode,
      manualChoices,
      'Шуурхай бөглөлт',
      parsedPre,
      parsedMid
    );
    onAddStudents([record]);
    setManualName('');
    setManualCode('');
    setManualPreScore('');
    setManualMidScore('');
    setManualChoices(new Array(quizQuestions.length).fill(-1));
  };

  // Class Summary & Rubric Mastery Analytics
  const classAverage =
    gradedStudents.length > 0
      ? Math.round(
          gradedStudents.reduce((s, r) => s + r.percentage, 0) / gradedStudents.length
        )
      : 0;

  const excellentCount = gradedStudents.filter((s) => s.rubricLevel === 'Маш сайн').length;
  const proficientCount = gradedStudents.filter((s) => s.rubricLevel === 'Хангалттай').length;
  const developingCount = gradedStudents.filter(
    (s) => s.rubricLevel === 'Дэмжлэг хэрэгтэй'
  ).length;

  // Group mastery by Rubric Criterion
  const criterionStats: Array<{ criterion: string; masteryPct: number; questionNums: number[] }> =
    [];
  const uniqueCriteria = Array.from(
    new Set(
      quizQuestions.map((q) => questionRubricMap[q.questionNumber] || 'Ерөнхий ойлголт')
    )
  );

  uniqueCriteria.forEach((crit) => {
    const linkedQuestions = quizQuestions.filter(
      (q) => (questionRubricMap[q.questionNumber] || 'Ерөнхий ойлголт') === crit
    );
    if (linkedQuestions.length === 0 || gradedStudents.length === 0) {
      criterionStats.push({
        criterion: crit,
        masteryPct: 0,
        questionNums: linkedQuestions.map((q) => q.questionNumber),
      });
      return;
    }

    let totalAttempts = 0;
    let totalRight = 0;
    gradedStudents.forEach((stu) => {
      linkedQuestions.forEach((lq) => {
        const qIdx = quizQuestions.findIndex((x) => x.questionNumber === lq.questionNumber);
        if (qIdx >= 0) {
          totalAttempts += 1;
          if (stu.selectedIndices[qIdx] === lq.correctIndex) {
            totalRight += 1;
          }
        }
      });
    });

    criterionStats.push({
      criterion: crit,
      masteryPct: totalAttempts > 0 ? Math.round((totalRight / totalAttempts) * 100) : 0,
      questionNums: linkedQuestions.map((q) => q.questionNumber),
    });
  });

  if (quizQuestions.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-[#57534E]">
        Эхлээд «AI бот 4 — Хариулт» хэсгээр тестийн асуулт болон түлхүүрийг үүсгэнэ үү.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Bubble Sheet Download */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-[#EFECE6]">
        <div>
          <div className="text-xs font-semibold text-[#78716C]">
            Автомат засагч · ZipGrade & Рубрикийн нэгдсэн үнэлгээний систем
          </div>
          <h3 className="mt-1 text-xl font-bold text-[#1C1917]">
            Тестийн үр дүнг автоматаар засаж рубрикээр дүгнэх
          </h3>
          <p className="mt-1 text-xs text-[#57534E]">
            Хариултын хуудсаа хэвлэж тараагаад: 1) Утас/камераар зураг дарж уншуулах, 2) ZipGrade аппын CSV оруулах, эсвэл 3) Дэлгэц дээр шуурхай дугуйлж дүгнэнэ.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() =>
              downloadBubbleSheetWord(goal, quizQuestions, questionRubricMap)
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#EB6B26] hover:bg-[#DC5E1B] text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>Хариултын хуудас (.doc) татах</span>
          </button>

          {gradedStudents.length > 0 && (
            <button
              type="button"
              onClick={() =>
                downloadGradebookCsv(
                  goal,
                  gradedStudents,
                  quizQuestions,
                  questionRubricMap
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#D6CEC2] bg-[#FAF8F5] hover:bg-[#F2EDE4] text-[#1C1917] text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#16A34A]" />
              <span>Дүн Excel (.csv) татах</span>
            </button>
          )}
        </div>
      </div>

      {/* 3 Automated Grading Entry Methods */}
      <div className="rounded-2xl bg-[#FAF8F5] border border-[#EAE4DC] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-[#EFECE5] w-fit">
          <button
            type="button"
            onClick={() => setEntryMode('camera')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              entryMode === 'camera'
                ? 'bg-white text-[#1C1917] shadow-xs'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            1. AI Камер / Зургаар засах
          </button>
          <button
            type="button"
            onClick={() => setEntryMode('csv')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              entryMode === 'csv'
                ? 'bg-white text-[#1C1917] shadow-xs'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            2. ZipGrade / Excel (.csv) оруулах
          </button>
          <button
            type="button"
            onClick={() => setEntryMode('manual')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              entryMode === 'manual'
                ? 'bg-white text-[#1C1917] shadow-xs'
                : 'text-[#57534E] hover:text-[#1C1917]'
            }`}
          >
            3. Шуурхай дугуйлагч (3 сек)
          </button>
        </div>

        {/* Mode 1: AI Optical Camera / Photo Upload */}
        {entryMode === 'camera' && (
          <div className="space-y-3">
            <p className="text-xs sm:text-sm text-[#44403C] leading-relaxed">
              Сурагчийн бөглөсөн хариултын хуудас эсвэл цаасан тестийн зургийг гар утсаараа дарж (эсвэл файлаар) оруулна уу. AI оптик уншигч сурагчийн нэр болон дугуйлсан <span className="font-semibold">А, Б, В, Г</span> хариултуудыг таньж рубрикээр шууд дүгнэнэ.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                className="hidden"
                id="zipgrade-photo-input"
              />
              <label
                htmlFor="zipgrade-photo-input"
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1C1917] hover:bg-[#292524] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer ${
                  isScanning ? 'opacity-60 pointer-events-none' : ''
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>
                  {isScanning
                    ? 'AI зураг уншиж засаж байна...'
                    : 'Тестийн хуудасны зураг оруулах / Камер нээх'}
                </span>
              </label>

              <span className="text-xs text-[#78716C]">
                Түлхүүр: {quizQuestions.map((q) => `${q.questionNumber}-${LETTERS[q.correctIndex]}`).join(' · ')}
              </span>
            </div>

            {scanMessage && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-[#EEFBF3] text-[#14532D] text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#16A34A]" />
                <span>{scanMessage}</span>
              </div>
            )}
            {scanError && (
              <div className="p-3 rounded-xl bg-[#FEF2F2] text-[#991B1B] text-xs font-medium">
                {scanError}
              </div>
            )}
            {scannedPreviewUrl && !isScanning && (
              <div className="pt-1">
                <img
                  src={scannedPreviewUrl}
                  alt="Уншуулсан тестийн хуудас"
                  referrerPolicy="no-referrer"
                  className="h-24 rounded-lg border border-[#DED8CE] object-cover"
                />
              </div>
            )}
          </div>
        )}

        {/* Mode 2: ZipGrade App CSV / Excel Import */}
        {entryMode === 'csv' && (
          <div className="space-y-3">
            <p className="text-xs sm:text-sm text-[#44403C] leading-relaxed">
              Гар утасны <strong>ZipGrade</strong> апп-аас экспорт хийсэн <code>.csv</code> файл эсвэл Google Forms / Excel-ийн хариултын хүснэгтийг оруулахад бүх ангийн дүнг нэг товшилтоор рубрикийн шалгуурт хөрвүүлэн бодно.
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvUpload}
                className="hidden"
                id="zipgrade-csv-input"
              />
              <label
                htmlFor="zipgrade-csv-input"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1C1917] hover:bg-[#292524] text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>ZipGrade / Excel (.csv) файл сонгох</span>
              </label>

              <button
                type="button"
                onClick={handleDownloadSampleZipGradeTemplate}
                className="px-3.5 py-2.5 rounded-xl border border-[#D6CEC2] bg-white hover:bg-[#F8F6F2] text-xs font-semibold text-[#44403C] transition-colors cursor-pointer"
              >
                Загвар CSV татах
              </button>
            </div>
            {csvFeedback && (
              <p className="text-xs font-semibold text-[#166534] bg-[#EEFBF3] px-3 py-2 rounded-lg">
                {csvFeedback}
              </p>
            )}
          </div>
        )}

        {/* Mode 3: Interactive Digital Bubble Sheet Clicker */}
        {entryMode === 'manual' && (
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Сурагчийн нэр (Б. Энхжин)"
                className="rounded-xl border border-[#DED8CE] bg-white px-3.5 py-2 text-sm text-[#1C1917] focus:border-[#EB6B26] focus:outline-none"
                required
              />
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Код / Анги (8Б-12)"
                className="rounded-xl border border-[#DED8CE] bg-white px-3.5 py-2 text-sm text-[#1C1917] focus:border-[#EB6B26] focus:outline-none"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={manualPreScore}
                onChange={(e) => setManualPreScore(e.target.value)}
                placeholder="Гарааны % (заавал биш)"
                className="rounded-xl border border-[#DED8CE] bg-white px-3.5 py-2 text-sm text-[#1C1917] tabular-nums focus:border-[#EB6B26] focus:outline-none"
              />
              <input
                type="number"
                min={0}
                max={100}
                value={manualMidScore}
                onChange={(e) => setManualMidScore(e.target.value)}
                placeholder="Явцын % (заавал биш)"
                className="rounded-xl border border-[#DED8CE] bg-white px-3.5 py-2 text-sm text-[#1C1917] tabular-nums focus:border-[#EB6B26] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {quizQuestions.map((q, qIdx) => (
                <div
                  key={q.questionNumber}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-[#EAE4DC]"
                >
                  <span className="font-mono tabular-nums text-xs font-bold text-[#1C1917]">
                    №{q.questionNumber}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {LETTERS.map((letter, optIdx) => {
                      const active = manualChoices[qIdx] === optIdx;
                      return (
                        <button
                          key={letter}
                          type="button"
                          onClick={() =>
                            setManualChoices((prev) => {
                              const copy = [...prev];
                              copy[qIdx] = optIdx;
                              return copy;
                            })
                          }
                          className={`w-7 h-7 rounded-full text-xs font-bold transition-colors cursor-pointer ${
                            active
                              ? 'bg-[#1C1917] text-white'
                              : 'bg-[#F5F2EC] text-[#57534E] hover:bg-[#E7E2DA]'
                          }`}
                        >
                          {letter}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#EB6B26] hover:bg-[#DC5E1B] text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Сурагчийн дүнг нэмэх</span>
            </button>
          </form>
        )}
      </div>

      {/* Question-to-Rubric Criterion Mapping */}
      <div>
        <h4 className="text-sm font-bold text-[#1C1917] mb-2.5">
          Асуулт бүрийг Рубрикийн шалгууртай холбосон тохиргоо
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {quizQuestions.map((q) => (
            <div
              key={q.questionNumber}
              className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-[#EAE4DC] bg-[#FCFBF9] text-xs"
            >
              <span className="font-semibold text-[#1C1917] truncate">
                Асуулт {q.questionNumber} (Зөв: {LETTERS[q.correctIndex]})
              </span>
              {rubricRows.length > 0 && (
                <select
                  value={questionRubricMap[q.questionNumber] || ''}
                  onChange={(e) =>
                    setQuestionRubricMap((prev) => ({
                      ...prev,
                      [q.questionNumber]: e.target.value,
                    }))
                  }
                  className="rounded-lg border border-[#DED8CE] bg-white px-2 py-1 text-xs text-[#44403C] max-w-[190px] truncate focus:border-[#EB6B26] focus:outline-none"
                >
                  {rubricRows.map((r) => (
                    <option key={r.criterion} value={r.criterion}>
                      {r.criterion}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Lesson Achievement & Student Progress Analytics Charts (Recharts) */}
      <div className="pt-2 border-t border-[#EFECE6]">
        <AchievementCharts
          gradedStudents={gradedStudents}
          quizQuestions={quizQuestions}
          criterionStats={criterionStats}
          onUpdateStudent={onUpdateStudent}
        />
      </div>

      {/* Rubric Mastery Breakdown & Class Summary */}
      <div className="space-y-4 pt-2 border-t border-[#EFECE6]">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h4 className="text-sm font-bold text-[#1C1917]">
            Рубрикийн шалгуур тус бүрийн ангийн эзэмшилт ({gradedStudents.length} сурагч)
          </h4>
          <div className="text-xs text-[#57534E] tabular-nums">
            <span>Дундаж: <strong>{classAverage}%</strong></span>
            <span className="mx-2">·</span>
            <span className="text-[#166534]">Маш сайн: {excellentCount}</span>
            <span className="mx-2">·</span>
            <span className="text-[#B45309]">Хангалттай: {proficientCount}</span>
            <span className="mx-2">·</span>
            <span className="text-[#991B1B]">Дэмжлэг хэрэгтэй: {developingCount}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {criterionStats.map((stat) => (
            <div
              key={stat.criterion}
              className="p-3.5 rounded-xl border border-[#EAE4DC] bg-[#FAF8F5] space-y-2"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-xs font-bold text-[#1C1917] truncate">
                  {stat.criterion}
                </span>
                <span className="font-mono tabular-nums text-xs font-bold text-[#D95D1E] shrink-0">
                  {stat.masteryPct}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#E7E2DA] overflow-hidden">
                <div
                  style={{ transform: `scaleX(${Math.max(0.04, stat.masteryPct / 100)})` }}
                  className={`h-full w-full origin-left transition-transform duration-200 ${
                    stat.masteryPct >= 75
                      ? 'bg-[#22A96B]'
                      : stat.masteryPct >= 55
                      ? 'bg-[#EB6B26]'
                      : 'bg-[#DC2626]'
                  }`}
                />
              </div>
              <div className="text-[11px] text-[#78716C] tabular-nums">
                Шалгасан даалгавар: Асуулт №{stat.questionNums.join(', №')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Student Gradebook Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-bold text-[#1C1917]">
            Сурагчдын тестийн болон рубрикийн дүнгийн жагсаалт
          </h4>
          {gradedStudents.length > 0 && (
            <button
              type="button"
              onClick={onClearAllStudents}
              className="text-xs text-[#78716C] hover:text-[#DC2626] underline underline-offset-4 cursor-pointer"
            >
              Жагсаалт цэвэрлэх
            </button>
          )}
        </div>

        {gradedStudents.length === 0 ? (
          <div className="py-8 text-center rounded-xl border border-[#EAE4DC] text-xs text-[#78716C]">
            Одоогоор сурагчийн хариулт бүртгэгдээгүй байна. Дээрх 3 аргаас сонгон оруулна уу.
          </div>
        ) : (
          <div className="overflow-x-auto border border-[#DED8CE] rounded-xl">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#FAF8F5] border-b border-[#DED8CE] text-xs font-semibold text-[#57534E]">
                  <th className="py-2.5 px-3">Код</th>
                  <th className="py-2.5 px-3">Сурагчийн нэр</th>
                  {quizQuestions.map((q) => (
                    <th key={q.questionNumber} className="py-2.5 px-2 text-center font-mono">
                      №{q.questionNumber}
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-right">Оноо</th>
                  <th className="py-2.5 px-3 text-right">Ахиц дэвшил</th>
                  <th className="py-2.5 px-3">Рубрик үнэлгээ</th>
                  <th className="py-2.5 px-2 text-right">Үйлдэл</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE6]">
                {gradedStudents.map((stu) => {
                  const stg = resolveStudentStageScores(stu);
                  return (
                    <tr key={stu.id} className="hover:bg-[#FCFBF9]">
                      <td className="py-2.5 px-3 font-mono tabular-nums text-xs text-[#78716C]">
                        {stu.studentCode}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-[#1C1917]">
                        <div>{stu.studentName}</div>
                        <div className="text-[10px] font-normal text-[#78716C]">
                          {stu.source}
                        </div>
                      </td>
                      {quizQuestions.map((q, qIdx) => {
                        const chosen = stu.selectedIndices[qIdx];
                        const isRight = chosen === q.correctIndex;
                        const letter = chosen >= 0 ? LETTERS[chosen] || '?' : '—';
                        return (
                          <td
                            key={q.questionNumber}
                            className={`py-2.5 px-2 text-center font-mono font-bold ${
                              isRight ? 'text-[#16A34A]' : 'text-[#DC2626]'
                            }`}
                          >
                            {letter}
                            {isRight ? '✓' : '✗'}
                          </td>
                        );
                      })}
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-[#1C1917] whitespace-nowrap">
                        {stu.correctCount}/{stu.totalQuestions} ({stu.percentage}%)
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-xs whitespace-nowrap">
                        <span className="text-[#78716C]">
                          {stg.pre}%→{stg.final}%
                        </span>{' '}
                        <span
                          className={`font-bold ${
                            stg.delta >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'
                          }`}
                        >
                          ({stg.delta >= 0 ? '+' : ''}
                          {stg.delta}%)
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`font-semibold text-xs ${
                            stu.rubricLevel === 'Маш сайн'
                              ? 'text-[#15804D]'
                              : stu.rubricLevel === 'Хангалттай'
                              ? 'text-[#B45309]'
                              : 'text-[#B91C1C]'
                          }`}
                        >
                          {stu.rubricLevel}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <button
                          type="button"
                          onClick={() => onRemoveStudent(stu.id)}
                          title="Устгах"
                          className="p-1.5 text-[#78716C] hover:text-[#DC2626] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
