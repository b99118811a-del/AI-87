import React, { useMemo, useState } from 'react';
import {
  Archive,
  Check,
  Download,
  FileDown,
  FolderOpen,
  Loader2,
  Printer,
  Search,
  Trash2,
} from 'lucide-react';
import type { GradedStudentRecord, LessonGoal, LessonOutputs, SavedLesson } from '../types';
import {
  computeLessonResultSummary,
  downloadPortfolioArchivePdf,
  downloadSingleLessonArchivePdf,
} from '../utils/pdfArchiveExport';

interface MyLessonsArchiveProps {
  savedLessons: SavedLesson[];
  activeLessonId: string;
  activeGoal: LessonGoal;
  activeOutputs: LessonOutputs;
  activeGradedStudents: GradedStudentRecord[];
  gradebookByLesson: Record<string, GradedStudentRecord[]>;
  onSelectLesson: (lesson: SavedLesson) => void;
  onSaveCurrentToArchive: (classGroup: string, teacherNote: string) => void;
  onDeleteArchivedLesson: (lessonId: string) => void;
  onPrintLessons: (lessons: SavedLesson[]) => void;
}

const CARD_TOP_BARS = [
  '#0EA5E9',
  '#F97316',
  '#10B981',
  '#6366F1',
  '#14B8A6',
  '#F59E0B',
];

function countReadyBots(outputs: LessonOutputs): number {
  let count = 0;
  if (outputs.research) count++;
  if (outputs.content) count++;
  if (outputs.report) count++;
  if (outputs.answers) count++;
  if (outputs.planner) count++;
  if (outputs.exercises) count++;
  return count;
}

export const MyLessonsArchive: React.FC<MyLessonsArchiveProps> = ({
  savedLessons,
  activeLessonId,
  activeGoal,
  activeOutputs,
  activeGradedStudents,
  gradebookByLesson,
  onSelectLesson,
  onSaveCurrentToArchive,
  onDeleteArchivedLesson,
  onPrintLessons,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [subjectFilter, setSubjectFilter] = useState<string>('ALL');
  const [classGroupInput, setClassGroupInput] = useState<string>('');
  const [teacherNoteInput, setTeacherNoteInput] = useState<string>('');
  const [justArchivedBanner, setJustArchivedBanner] = useState<boolean>(false);

  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isDownloadingBundle, setIsDownloadingBundle] = useState<boolean>(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const resolveStudentsForLesson = (lesson: SavedLesson): GradedStudentRecord[] => {
    const live = gradebookByLesson[lesson.id];
    if (live && live.length > 0) return live;
    return lesson.gradedStudents || [];
  };

  const uniqueSubjects = useMemo(() => {
    const set = new Set<string>();
    savedLessons.forEach((l) => {
      if (l.goal.subject) set.add(l.goal.subject);
    });
    return Array.from(set);
  }, [savedLessons]);

  const filteredLessons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return savedLessons.filter((item) => {
      if (subjectFilter !== 'ALL' && item.goal.subject !== subjectFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.goal.topic.toLowerCase().includes(q) ||
        item.goal.subject.toLowerCase().includes(q) ||
        item.goal.grade.toLowerCase().includes(q) ||
        (item.classGroup || '').toLowerCase().includes(q) ||
        (item.teacherNote || '').toLowerCase().includes(q)
      );
    });
  }, [savedLessons, searchQuery, subjectFilter]);

  const archiveKpis = useMemo(() => {
    let gradedLessonsCount = 0;
    let totalGradedStudents = 0;
    let sumAvgFinal = 0;

    savedLessons.forEach((l) => {
      const stus = resolveStudentsForLesson(l);
      const summary = computeLessonResultSummary(stus);
      if (summary.studentCount > 0) {
        gradedLessonsCount++;
        totalGradedStudents += summary.studentCount;
        sumAvgFinal += summary.avgFinal;
      }
    });

    return {
      totalLessons: savedLessons.length,
      gradedLessonsCount,
      totalGradedStudents,
      overallAvgPct:
        gradedLessonsCount > 0 ? Math.round(sumAvgFinal / gradedLessonsCount) : 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedLessons, gradebookByLesson]);

  const selectedList = useMemo(
    () => filteredLessons.filter((l) => Boolean(selectedIds[l.id])),
    [filteredLessons, selectedIds]
  );

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelectAllFiltered = () => {
    const allSelected =
      filteredLessons.length > 0 &&
      filteredLessons.every((l) => Boolean(selectedIds[l.id]));
    if (allSelected) {
      setSelectedIds({});
    } else {
      const next: Record<string, boolean> = {};
      filteredLessons.forEach((l) => {
        next[l.id] = true;
      });
      setSelectedIds(next);
    }
  };

  const handleArchiveActiveNow = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveCurrentToArchive(classGroupInput.trim(), teacherNoteInput.trim());
    setClassGroupInput('');
    setTeacherNoteInput('');
    setJustArchivedBanner(true);
    window.setTimeout(() => setJustArchivedBanner(false), 2200);
  };

  const handleDownloadSinglePdf = async (lesson: SavedLesson) => {
    if (downloadingId) return;
    setDownloadingId(lesson.id);
    try {
      const stus = resolveStudentsForLesson(lesson);
      await downloadSingleLessonArchivePdf(lesson, stus);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDownloadPortfolioPdf = async () => {
    if (isDownloadingBundle) return;
    const targets = selectedList.length > 0 ? selectedList : filteredLessons;
    if (targets.length === 0) return;

    setIsDownloadingBundle(true);
    try {
      const entries = targets.map((lesson) => ({
        lesson,
        students: resolveStudentsForLesson(lesson),
      }));
      await downloadPortfolioArchivePdf(entries);
    } finally {
      setIsDownloadingBundle(false);
    }
  };

  const activeBotCount = countReadyBots(activeOutputs);

  return (
    <section
      id="my-lessons-archive"
      className="rounded-3xl bg-white border border-slate-200/90 p-5 sm:p-7 space-y-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
    >
      {/* Header + Portfolio PDF Export CTA */}
      <div className="flex flex-wrap items-start justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="text-xs font-bold text-[#EA580C]">
            Багшийн цахим сан · Төлөвлөлт ба ZipGrade үнэлгээний нэгдсэн архив
          </div>
          <h2 className="mt-0.5 text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Миний хичээлүүд (PDF Архив)
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500">
            Бэлтгэсэн хичээлийн төлөвлөлт болон сурагчдын шалгалтын үр дүнг цуглуулан хадгалж, нэг бүрчлэн эсвэл багцаар нь PDF файл болгон татаж авна.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={isDownloadingBundle || filteredLessons.length === 0}
            onClick={handleDownloadPortfolioPdf}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#0F172A] to-[#1E293B] hover:from-[#1E293B] hover:to-[#334155] text-white text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
          >
            {isDownloadingBundle ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                <span>PDF архив үүсгэж байна...</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4 text-sky-400" />
                <span>
                  {selectedList.length > 0
                    ? `Сонгосон ${selectedList.length} хичээлийг нэгтгэж PDF татах`
                    : `Бүх хичээлийг нэгтгэж PDF татах (${filteredLessons.length})`}
                </span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={filteredLessons.length === 0}
            onClick={() =>
              onPrintLessons(selectedList.length > 0 ? selectedList : filteredLessons)
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>Багцаар хэвлэх</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl bg-slate-50 border border-slate-200/70 p-4">
          <div className="text-xs font-semibold text-slate-500">
            Архивласан хичээл
          </div>
          <div className="mt-1 font-mono tabular-nums text-2xl font-extrabold text-slate-900">
            {archiveKpis.totalLessons}
          </div>
        </div>
        <div className="rounded-2xl bg-sky-50/70 border border-sky-200/70 p-4">
          <div className="text-xs font-semibold text-sky-800">
            Үнэлгээтэй хичээл
          </div>
          <div className="mt-1 font-mono tabular-nums text-2xl font-extrabold text-sky-950">
            {archiveKpis.gradedLessonsCount}
          </div>
        </div>
        <div className="rounded-2xl bg-indigo-50/70 border border-indigo-200/70 p-4">
          <div className="text-xs font-semibold text-indigo-800">
            Шалгасан нийт сурагч
          </div>
          <div className="mt-1 font-mono tabular-nums text-2xl font-extrabold text-indigo-950">
            {archiveKpis.totalGradedStudents}
          </div>
        </div>
        <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/70 p-4">
          <div className="text-xs font-semibold text-emerald-800">
            Архивын дундаж амжилт
          </div>
          <div className="mt-1 font-mono tabular-nums text-2xl font-extrabold text-emerald-950">
            {archiveKpis.overallAvgPct}%
          </div>
        </div>
      </div>

      {/* Save / Snapshot Current Active Lesson + ZipGrade Results Form */}
      <form
        onSubmit={handleArchiveActiveNow}
        className="rounded-2xl bg-gradient-to-r from-orange-50/90 via-amber-50/70 to-sky-50/70 border border-orange-200/70 p-4 sm:p-5 space-y-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs sm:text-sm font-extrabold text-slate-900">
            Одоогийн идэвхтэй хичээлийг үр дүнгийн хамт архивт хадгалах:{' '}
            <span className="text-[#EA580C]">«{activeGoal.topic}»</span>
          </div>
          <div className="text-xs text-slate-600 tabular-nums">
            {activeGoal.subject} · {activeGoal.grade} · {activeBotCount}/6 бот бэлэн ·{' '}
            {activeGradedStudents.length} сурагчийн дүн
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <input
            type="text"
            value={classGroupInput}
            onChange={(e) => setClassGroupInput(e.target.value)}
            placeholder="Анги / Бүлэг (жишээ нь: 8А бүлэг)"
            className="sm:col-span-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#F97316] focus:outline-none"
          />
          <input
            type="text"
            value={teacherNoteInput}
            onChange={(e) => setTeacherNoteInput(e.target.value)}
            placeholder="Ээлжит хичээлийн үр дүнгийн товч тэмдэглэл (заавал биш)..."
            className="sm:col-span-6 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#F97316] focus:outline-none"
          />
          <button
            type="submit"
            className="sm:col-span-3 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            {justArchivedBanner ? (
              <>
                <Check className="w-4 h-4" />
                <span>Архивт хадгалагдлаа!</span>
              </>
            ) : (
              <>
                <Archive className="w-4 h-4" />
                <span>Архивт шинэчилж хадгалах</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Search + Subject Filter + Select All Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[240px]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Сэдэв, хичээл, бүлгээр хайх..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#F97316] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100">
            <button
              type="button"
              onClick={() => setSubjectFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                subjectFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Бүгд ({savedLessons.length})
            </button>
            {uniqueSubjects.slice(0, 5).map((subj) => (
              <button
                key={subj}
                type="button"
                onClick={() => setSubjectFilter(subj)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  subjectFilter === subj
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {subj}
              </button>
            ))}
          </div>
        </div>

        {filteredLessons.length > 0 && (
          <button
            type="button"
            onClick={handleSelectAllFiltered}
            className="text-xs font-bold text-slate-700 hover:text-slate-950 underline underline-offset-4 cursor-pointer whitespace-nowrap"
          >
            {filteredLessons.every((l) => Boolean(selectedIds[l.id]))
              ? 'Сонголтыг цуцлах'
              : 'Бүгдийг сонгох'}
          </button>
        )}
      </div>

      {/* Archived Lessons Cards Grid */}
      {filteredLessons.length === 0 ? (
        <div className="py-12 text-center rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
          <p className="text-sm font-bold text-slate-700">
            Таны хайлтад тохирох архивласан хичээл олдсонгүй.
          </p>
          <p className="text-xs text-slate-500">
            Дээрх «Архивт шинэчилж хадгалах» товчийг дарж одоогийн хичээлээ хадгална уу.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLessons.map((lesson, idx) => {
            const isCurrent = lesson.id === activeLessonId;
            const isSelected = Boolean(selectedIds[lesson.id]);
            const stus = resolveStudentsForLesson(lesson);
            const summary = computeLessonResultSummary(stus);
            const readyCount = countReadyBots(lesson.outputs);
            const topColor = CARD_TOP_BARS[idx % CARD_TOP_BARS.length];
            const isThisDownloading = downloadingId === lesson.id;

            return (
              <div
                key={lesson.id}
                className={`rounded-2xl bg-white border transition-shadow overflow-hidden flex flex-col justify-between ${
                  isCurrent
                    ? 'border-[#F97316] shadow-md'
                    : 'border-slate-200/90 hover:shadow-md'
                }`}
              >
                <div>
                  {/* Color Accent Top Hairline */}
                  <div
                    style={{ backgroundColor: topColor }}
                    className="h-1.5 w-full"
                  />

                  <div className="p-5 space-y-3">
                    {/* Metadata line + Selection checkbox */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-500 leading-snug">
                        <span className="text-slate-800 font-bold">
                          {lesson.goal.subject}
                        </span>
                        <span className="mx-1.5">·</span>
                        <span>{lesson.goal.grade}</span>
                        {lesson.classGroup && (
                          <>
                            <span className="mx-1.5">·</span>
                            <span className="text-indigo-700 font-bold">
                              {lesson.classGroup}
                            </span>
                          </>
                        )}
                        <span className="mx-1.5">·</span>
                        <span className="tabular-nums">
                          {lesson.goal.durationMinutes} мин
                        </span>
                      </div>

                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelect(lesson.id)}
                        aria-label={`${lesson.goal.topic} сонгох`}
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316] cursor-pointer shrink-0"
                      />
                    </div>

                    {/* Lesson Topic Title */}
                    <h3 className="text-base font-extrabold text-slate-900 line-clamp-2 leading-snug">
                      {lesson.goal.topic}
                    </h3>

                    {lesson.teacherNote && (
                      <p className="text-xs text-slate-600 line-clamp-2">
                        Тэмдэглэл: {lesson.teacherNote}
                      </p>
                    )}

                    {/* Plan & ZipGrade Outcome Snapshot */}
                    <div className="pt-2.5 border-t border-slate-100 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-600 tabular-nums">
                        <span>Төлөвлөлт: {readyCount}/6 бот</span>
                        <span>
                          {lesson.savedDate
                            ? `${lesson.savedDate} · ${lesson.createdAt}`
                            : lesson.createdAt}
                        </span>
                      </div>

                      {summary.studentCount > 0 ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs tabular-nums">
                            <span className="font-semibold text-slate-700">
                              {summary.studentCount} сурагч · Дундаж{' '}
                              <strong className="text-indigo-700">
                                {summary.avgFinal}%
                              </strong>
                            </span>
                            <span className="font-mono font-bold text-emerald-700">
                              {summary.avgDelta >= 0 ? '+' : ''}
                              {summary.avgDelta}% ахиц
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              style={{
                                transform: `scaleX(${Math.max(
                                  0.06,
                                  summary.avgFinal / 100
                                )})`,
                                backgroundColor: topColor,
                              }}
                              className="h-full w-full origin-left"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">
                          Сурагчийн үнэлгээ хараахан бүртгэгдээгүй
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectLesson(lesson)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                        isCurrent
                          ? 'bg-orange-100 text-orange-900'
                          : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-100'
                      }`}
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>{isCurrent ? 'Идэвхтэй' : 'Нээх'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isThisDownloading}
                      onClick={() => handleDownloadSinglePdf(lesson)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
                    >
                      {isThisDownloading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>PDF...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5 text-sky-400" />
                          <span>PDF татах</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onPrintLessons([lesson])}
                      title="Хэвлэх"
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>

                    {savedLessons.length > 1 && (
                      <>
                        {confirmDeleteId === lesson.id ? (
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteArchivedLesson(lesson.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-1 rounded-lg bg-red-600 text-white text-[11px] font-bold cursor-pointer whitespace-nowrap"
                          >
                            Устгах уу?
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(lesson.id)}
                            title="Архиваас устгах"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
