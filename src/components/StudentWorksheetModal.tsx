import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  FileDown,
  Loader2,
  Printer,
  RefreshCw,
  X,
} from 'lucide-react';
import type {
  LessonGoal,
  LessonOutputs,
  StudentWorksheetData,
} from '../types';
import {
  buildWorksheetFullHtml,
  DEFAULT_WORKSHEET_FLAGS,
  downloadStudentWorksheetPdf,
  downloadStudentWorksheetWord,
  synthesizeWorksheetFromLessonPlan,
  type WorksheetSectionFlags,
} from '../utils/studentWorksheetExport';

interface StudentWorksheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: LessonGoal;
  outputs: LessonOutputs;
  onPrintWorksheetHtml: (combinedHtml: string) => void;
}

export const StudentWorksheetModal: React.FC<StudentWorksheetModalProps> = ({
  isOpen,
  onClose,
  goal,
  outputs,
  onPrintWorksheetHtml,
}) => {
  const [variantLabel, setVariantLabel] = useState<'А хувилбар' | 'Б хувилбар'>(
    'А хувилбар'
  );
  const [showTeacherKey, setShowTeacherKey] = useState<boolean>(false);
  const [flags, setFlags] = useState<WorksheetSectionFlags>(
    DEFAULT_WORKSHEET_FLAGS
  );
  const [customWorksheet, setCustomWorksheet] =
    useState<StudentWorksheetData | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState<boolean>(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Reset custom AI override when lesson topic changes
  useEffect(() => {
    setCustomWorksheet(null);
    setAiError(null);
  }, [goal.topic, goal.subject, goal.grade]);

  const activeWorksheet: StudentWorksheetData = useMemo(() => {
    if (customWorksheet) {
      return { ...customWorksheet, variantLabel };
    }
    return synthesizeWorksheetFromLessonPlan(goal, outputs, variantLabel);
  }, [customWorksheet, goal, outputs, variantLabel]);

  const { page1Html, page2Html, combinedWordBodyHtml } = useMemo(
    () =>
      buildWorksheetFullHtml(
        goal,
        outputs,
        activeWorksheet,
        flags,
        showTeacherKey
      ),
    [goal, outputs, activeWorksheet, flags, showTeacherKey]
  );

  if (!isOpen) return null;

  const handleGenerateAiVariant = async (
    targetVariant: 'А хувилбар' | 'Б хувилбар'
  ) => {
    if (isGeneratingAi) return;
    setVariantLabel(targetVariant);
    setIsGeneratingAi(true);
    setAiError(null);

    try {
      const planSummary = outputs.planner
        ? [
            `Суралцахуйн зорилт: ${outputs.planner.overview.curriculumObjective}`,
            ...outputs.planner.stagesTable.map(
              (s) =>
                `- ${s.stageName} (${s.durationMinutes} мин): ${s.studentActivity}`
            ),
          ].join('\n')
        : outputs.content?.lessonObjective || '';

      const res = await fetch('/api/bots/worksheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal,
          variantLabel: targetVariant,
          planSummary,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Даалгаврын хуудас шинэчлэхэд алдаа гарлаа.');
      }
      setCustomWorksheet(data as StudentWorksheetData);
    } catch (err: unknown) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'AI даалгавар зохиоход алдаа гарлаа.'
      );
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (isDownloadingPdf) return;
    setIsDownloadingPdf(true);
    try {
      await downloadStudentWorksheetPdf(
        goal,
        outputs,
        activeWorksheet,
        flags,
        showTeacherKey
      );
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handlePrintNow = () => {
    const fullPrintMarkup = `
      <div style="background:#FFFFFF;color:#0F172A;">
        ${combinedWordBodyHtml}
      </div>
    `;
    onPrintWorksheetHtml(fullPrintMarkup);
  };

  const toggleFlag = (key: keyof WorksheetSectionFlags) => {
    setFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="student-worksheet-modal-title"
      className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/65 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl max-h-[93vh] flex flex-col rounded-3xl bg-[#F8FAFC] border border-slate-200 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="bg-white border-b border-slate-200 px-5 sm:px-7 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div>
            <div className="text-xs font-bold text-teal-700">
              Ээлжит хичээлийн төлөвлөгөөнд суурилсан хэвлэмэл материал
            </div>
            <h2
              id="student-worksheet-modal-title"
              className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight"
            >
              Сурагчийн «Даалгаврын хуудас» (Student Worksheet)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handlePrintNow}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-4 h-4" />
              <span>Шууд хэвлэх (A4)</span>
            </button>

            <button
              type="button"
              disabled={isDownloadingPdf}
              onClick={handleDownloadPdf}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              {isDownloadingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                  <span>PDF бэлтгэж байна...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4 text-sky-400" />
                  <span>PDF татах (.pdf)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                downloadStudentWorksheetWord(
                  goal,
                  outputs,
                  activeWorksheet,
                  flags,
                  showTeacherKey
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              <Download className="w-4 h-4 text-teal-600" />
              <span>Word (.doc)</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Хаах"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Two-Zone Body: Left Control Deck + Right Live A4 Preview */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-5 p-4 sm:p-6">
          {/* Left Controls (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Student vs Teacher Key Switch */}
            <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
              <div className="text-xs font-extrabold text-slate-900">
                1. Хэвлэх хувилбар сонгох
              </div>
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100">
                <button
                  type="button"
                  onClick={() => setShowTeacherKey(false)}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    !showTeacherKey
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Сурагчийн хувь
                </button>
                <button
                  type="button"
                  onClick={() => setShowTeacherKey(true)}
                  className={`py-2 px-2.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                    showTeacherKey
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Багшийн түлхүүр
                </button>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                «Сурагчийн хувь» нь хариултгүй, бодолт бичих мөртэй хэвлэгдэнэ. «Багшийн түлхүүр» нь зөв хариулт, бодолтын хамт гарна.
              </p>
            </div>

            {/* AI Variant Generator (А / Б хувилбар) */}
            <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
              <div className="text-xs font-extrabold text-slate-900">
                2. AI-аар шинэ хувилбар зохиох (А / Б)
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ээлжит хичээлийн төлөвлөгөөн дээр үндэслэн сурагчдад салаалж тараах шинэ даалгавруудыг AI-аар үүсгэнэ.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isGeneratingAi}
                  onClick={() => handleGenerateAiVariant('А хувилбар')}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      isGeneratingAi && variantLabel === 'А хувилбар'
                        ? 'animate-spin'
                        : ''
                    }`}
                  />
                  <span>А хувилбар (AI)</span>
                </button>
                <button
                  type="button"
                  disabled={isGeneratingAi}
                  onClick={() => handleGenerateAiVariant('Б хувилбар')}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      isGeneratingAi && variantLabel === 'Б хувилбар'
                        ? 'animate-spin'
                        : ''
                    }`}
                  />
                  <span>Б хувилбар (AI)</span>
                </button>
              </div>
              {aiError && (
                <p className="text-xs text-red-600 font-medium">{aiError}</p>
              )}
            </div>

            {/* Included Worksheet Sections */}
            <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-2.5">
              <div className="text-xs font-extrabold text-slate-900 mb-1">
                3. Хуудсанд оруулах хэсгүүд
              </div>

              {[
                {
                  key: 'includeMatching' as const,
                  label: 'Түлхүүр ухагдахуун харгалзуулах хүснэгт',
                },
                {
                  key: 'includeFillBlanks' as const,
                  label: 'Цэгийн оронд үг нөхөж бичих дасгал',
                },
                {
                  key: 'includeGuidedTasks' as const,
                  label: 'Төлөвлөгөөний явцын чиглүүлэгтэй даалгавар',
                },
                {
                  key: 'includeTieredProblems' as const,
                  label: 'А, Б, В түвшний бие даах бодлого дасгал',
                },
                {
                  key: 'includeHints' as const,
                  label: 'Бодлогын дөхүүлэх санамж (Hint) харуулах',
                },
                {
                  key: 'includeQuiz' as const,
                  label: 'Мэдлэг бататгах 5 сонгох тест',
                },
                {
                  key: 'includeSelfCheck' as const,
                  label: 'Өөрийн үнэлгээ ба Гэрийн даалгавар',
                },
              ].map((item) => (
                <label
                  key={item.key}
                  className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none py-0.5"
                >
                  <input
                    type="checkbox"
                    checked={flags[item.key]}
                    onChange={() => toggleFlag(item.key)}
                    className="w-4 h-4 rounded border-slate-300 text-[#EA580C] focus:ring-[#EA580C]"
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Right Live A4 Paper Sheet Preview (8 cols) */}
          <div className="lg:col-span-8 space-y-5 overflow-x-auto">
            <div className="text-xs font-bold text-slate-500 flex items-center justify-between">
              <span>A4 хуудасны бодит урьдчилан харагдац</span>
              <span>
                {page2Html ? 'Нийт 2 нүүр (A4)' : 'Нийт 1 нүүр (A4)'}
              </span>
            </div>

            <div className="space-y-6 flex flex-col items-center">
              <div
                className="shadow-lg rounded-xl overflow-hidden border border-slate-300 bg-white max-w-full"
                style={{ zoom: 0.82 }}
                dangerouslySetInnerHTML={{ __html: page1Html }}
              />
              {page2Html && (
                <div
                  className="shadow-lg rounded-xl overflow-hidden border border-slate-300 bg-white max-w-full"
                  style={{ zoom: 0.82 }}
                  dangerouslySetInnerHTML={{ __html: page2Html }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
