import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { resolveStudentStageScores } from '../components/AchievementCharts';
import type { GradedStudentRecord, SavedLesson } from '../types';

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface LessonResultSummary {
  studentCount: number;
  avgPre: number;
  avgFinal: number;
  avgDelta: number;
  qualityPct: number;
  excellentCount: number;
  proficientCount: number;
  supportCount: number;
}

export function computeLessonResultSummary(
  students: GradedStudentRecord[] = []
): LessonResultSummary {
  if (!students || students.length === 0) {
    return {
      studentCount: 0,
      avgPre: 0,
      avgFinal: 0,
      avgDelta: 0,
      qualityPct: 0,
      excellentCount: 0,
      proficientCount: 0,
      supportCount: 0,
    };
  }

  const stages = students.map((s) => resolveStudentStageScores(s));
  const n = students.length;
  const avgPre = Math.round(stages.reduce((a, b) => a + b.pre, 0) / n);
  const avgFinal = Math.round(stages.reduce((a, b) => a + b.final, 0) / n);
  const excellentCount = students.filter((s) => s.rubricLevel === 'Маш сайн').length;
  const proficientCount = students.filter((s) => s.rubricLevel === 'Хангалттай').length;
  const supportCount = students.filter(
    (s) => s.rubricLevel === 'Дэмжлэг хэрэгтэй'
  ).length;

  return {
    studentCount: n,
    avgPre,
    avgFinal,
    avgDelta: avgFinal - avgPre,
    qualityPct: Math.round((excellentCount / n) * 100),
    excellentCount,
    proficientCount,
    supportCount,
  };
}

function buildLessonPlanPageHtml(
  lesson: SavedLesson,
  indexLabel?: string
): string {
  const { goal, outputs } = lesson;
  const dateStr =
    lesson.savedDate ||
    new Date().toLocaleDateString('mn-MN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });

  const planner = outputs.planner;
  const research = outputs.research;
  const content = outputs.content;

  const stagesRowsHtml = planner?.stagesTable?.length
    ? planner.stagesTable
        .map(
          (row) => `
        <tr>
          <td style="border:1px solid #CBD5E1;padding:6px 8px;font-weight:700;color:#0F172A;">${escapeHtml(
            row.stageName
          )}</td>
          <td style="border:1px solid #CBD5E1;padding:6px 8px;text-align:right;font-family:monospace;white-space:nowrap;">${
            row.durationMinutes
          } мин</td>
          <td style="border:1px solid #CBD5E1;padding:6px 8px;">${escapeHtml(
            row.learningObjective
          )}</td>
          <td style="border:1px solid #CBD5E1;padding:6px 8px;">${escapeHtml(
            row.teacherActivity
          )}</td>
          <td style="border:1px solid #CBD5E1;padding:6px 8px;">${escapeHtml(
            row.studentActivity
          )}</td>
          <td style="border:1px solid #CBD5E1;padding:6px 8px;">${escapeHtml(
            row.assessmentCheck
          )}</td>
        </tr>`
        )
        .join('')
    : content?.timeline?.length
    ? content.timeline
        .map(
          (t) => `
        <tr>
          <td style="border:1px solid #CBD5E1;padding:6px 8px;font-weight:700;">${escapeHtml(
            t.phase
          )}</td>
          <td style="border:1px solid #CBD5E1;padding:6px 8px;text-align:right;font-family:monospace;">${
            t.durationMinutes
          } мин</td>
          <td style="border:1px solid #CBD5E1;padding:6px 8px;">—</td>
          <td style="border:1px solid #CBD5E1;padding:6px 8px;">${escapeHtml(
            t.teacherAction
          )}</td>
          <td style="border:1px solid #CBD5E1;padding:6px 8px;">${escapeHtml(
            t.studentActivity
          )}</td>
          <td style="border:1px solid #CBD5E1;padding:6px 8px;">Явцын үнэлгээ</td>
        </tr>`
        )
        .join('')
    : `<tr><td colspan="6" style="border:1px solid #CBD5E1;padding:10px;text-align:center;color:#64748B;">Төлөвлөлтийн хүснэгт хоосон байна.</td></tr>`;

  const conceptsHtml = research?.keyConcepts?.length
    ? research.keyConcepts
        .slice(0, 4)
        .map(
          (c) =>
            `<div style="margin-bottom:4px;"><b>• ${escapeHtml(
              c.term
            )}:</b> ${escapeHtml(c.definition)} <span style="color:#475569;">(Зүйрлэл: ${escapeHtml(
              c.classroomAnalogy
            )})</span></div>`
        )
        .join('')
    : '';

  return `
    <div class="pdf-a4-page" style="width:794px;min-height:1123px;box-sizing:border-box;background:#FFFFFF;color:#0F172A;padding:36px 40px;font-family:'Manrope',system-ui,-apple-system,sans-serif;font-size:11px;line-height:1.45;">
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#475569;margin-bottom:10px;">
        <span>БАТЛАВ: СУРГАЛТЫН МЕНЕЖЕР ...........................................</span>
        <span>AI-87 ХИЧЭЭЛИЙН ЦАХИМ АРХИВ ${indexLabel ? `· ${escapeHtml(indexLabel)}` : ''}</span>
      </div>

      <div style="background:#0F172A;color:#FFFFFF;border-radius:12px;padding:16px 20px;margin-bottom:16px;">
        <div style="font-size:10px;font-weight:700;color:#38BDF8;margin-bottom:4px;">
          ${escapeHtml(goal.subject)} · ${escapeHtml(goal.grade)}${
    lesson.classGroup ? ` · ${escapeHtml(lesson.classGroup)}` : ''
  } · ${goal.durationMinutes} минут · Огноо: ${escapeHtml(dateStr)}
        </div>
        <div style="font-size:18px;font-weight:800;line-height:1.25;">
          ${escapeHtml(goal.topic)}
        </div>
        ${
          lesson.teacherNote
            ? `<div style="margin-top:6px;font-size:10.5px;color:#CBD5E1;">Багшийн тэмдэглэл: ${escapeHtml(
                lesson.teacherNote
              )}</div>`
            : ''
        }
      </div>

      ${
        planner
          ? `
        <table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:10.5px;">
          <tbody>
            <tr>
              <td style="border:1px solid #CBD5E1;background:#F8FAFC;padding:6px 8px;font-weight:700;width:24%;">Бүлэг сэдэв</td>
              <td style="border:1px solid #CBD5E1;padding:6px 8px;">${escapeHtml(
                planner.overview.unitName
              )}</td>
            </tr>
            <tr>
              <td style="border:1px solid #CBD5E1;background:#F8FAFC;padding:6px 8px;font-weight:700;">Суралцахуйн зорилт</td>
              <td style="border:1px solid #CBD5E1;padding:6px 8px;">${escapeHtml(
                planner.overview.curriculumObjective
              )}</td>
            </tr>
            <tr>
              <td style="border:1px solid #CBD5E1;background:#F8FAFC;padding:6px 8px;font-weight:700;">Арга зүй ба Хэрэглэгдэхүүн</td>
              <td style="border:1px solid #CBD5E1;padding:6px 8px;">${escapeHtml(
                planner.overview.methodology
              )} · ${escapeHtml(planner.overview.resources)}</td>
            </tr>
          </tbody>
        </table>`
          : content
          ? `<div style="margin-bottom:12px;padding:8px 12px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;"><b>Хичээлийн зорилго:</b> ${escapeHtml(
              content.lessonObjective
            )}</div>`
          : ''
      }

      ${
        conceptsHtml
          ? `<div style="margin-bottom:14px;">
              <div style="font-size:12px;font-weight:800;color:#0F172A;margin-bottom:6px;">1. Онолын тулгуур ойлголтууд (Судалгаа бот)</div>
              <div style="font-size:10.5px;color:#1E293B;">${conceptsHtml}</div>
            </div>`
          : ''
      }

      <div>
        <div style="font-size:12px;font-weight:800;color:#0F172A;margin-bottom:6px;">2. Ээлжит хичээлийн үйл ажиллагааны төлөвлөлт (${
          goal.durationMinutes
        } минут)</div>
        <table style="width:100%;border-collapse:collapse;font-size:10px;">
          <thead>
            <tr style="background:#F1F5F9;color:#0F172A;">
              <th style="border:1px solid #CBD5E1;padding:6px 8px;text-align:left;width:14%;">Үе шат</th>
              <th style="border:1px solid #CBD5E1;padding:6px 8px;text-align:right;width:8%;">Цаг</th>
              <th style="border:1px solid #CBD5E1;padding:6px 8px;text-align:left;width:18%;">Зорилт</th>
              <th style="border:1px solid #CBD5E1;padding:6px 8px;text-align:left;width:23%;">Багшийн чиглүүлэг</th>
              <th style="border:1px solid #CBD5E1;padding:6px 8px;text-align:left;width:23%;">Сурагчийн үйл ажиллагаа</th>
              <th style="border:1px solid #CBD5E1;padding:6px 8px;text-align:left;width:14%;">Үнэлгээ</th>
            </tr>
          </thead>
          <tbody>
            ${stagesRowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function buildLessonResultsPageHtml(
  lesson: SavedLesson,
  students: GradedStudentRecord[]
): string {
  const { goal, outputs } = lesson;
  const stats = computeLessonResultSummary(students);
  const optionLetters = ['А', 'Б', 'В', 'Г'];

  const rubricHtml = outputs.report?.rubric?.length
    ? `
      <div style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:800;color:#0F172A;margin-bottom:6px;">3. Үнэлгээний рубрик (100 оноо)</div>
        <table style="width:100%;border-collapse:collapse;font-size:10px;">
          <thead>
            <tr style="background:#F1F5F9;">
              <th style="border:1px solid #CBD5E1;padding:5px 7px;text-align:left;width:22%;">Шалгуур</th>
              <th style="border:1px solid #CBD5E1;padding:5px 7px;text-align:left;width:34%;">Маш сайн</th>
              <th style="border:1px solid #CBD5E1;padding:5px 7px;text-align:left;width:34%;">Хангалттай</th>
              <th style="border:1px solid #CBD5E1;padding:5px 7px;text-align:right;width:10%;">Оноо</th>
            </tr>
          </thead>
          <tbody>
            ${outputs.report.rubric
              .map(
                (r) => `
              <tr>
                <td style="border:1px solid #CBD5E1;padding:5px 7px;font-weight:700;">${escapeHtml(
                  r.criterion
                )}</td>
                <td style="border:1px solid #CBD5E1;padding:5px 7px;">${escapeHtml(
                  r.excellent
                )}</td>
                <td style="border:1px solid #CBD5E1;padding:5px 7px;">${escapeHtml(
                  r.proficient
                )}</td>
                <td style="border:1px solid #CBD5E1;padding:5px 7px;text-align:right;font-family:monospace;font-weight:700;">${
                  r.maxScore
                }</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>`
    : '';

  const exercisesSummaryHtml = outputs.exercises?.problems?.length
    ? `
      <div style="margin-bottom:14px;">
        <div style="font-size:12px;font-weight:800;color:#0F172A;margin-bottom:6px;">4. Шаталсан бодлого дасгал ба сорилын түлхүүр</div>
        <table style="width:100%;border-collapse:collapse;font-size:9.8px;margin-bottom:6px;">
          <thead>
            <tr style="background:#F1F5F9;">
              <th style="border:1px solid #CBD5E1;padding:5px 7px;text-align:left;width:10%;">Код</th>
              <th style="border:1px solid #CBD5E1;padding:5px 7px;text-align:left;width:16%;">Түвшин</th>
              <th style="border:1px solid #CBD5E1;padding:5px 7px;text-align:left;width:50%;">Даалгавар</th>
              <th style="border:1px solid #CBD5E1;padding:5px 7px;text-align:left;width:16%;">Хариу</th>
              <th style="border:1px solid #CBD5E1;padding:5px 7px;text-align:right;width:8%;">Оноо</th>
            </tr>
          </thead>
          <tbody>
            ${outputs.exercises.problems
              .slice(0, 6)
              .map(
                (p) => `
              <tr>
                <td style="border:1px solid #CBD5E1;padding:4px 7px;font-weight:700;">${escapeHtml(
                  p.code
                )}</td>
                <td style="border:1px solid #CBD5E1;padding:4px 7px;">${escapeHtml(
                  p.tier
                )}</td>
                <td style="border:1px solid #CBD5E1;padding:4px 7px;">${escapeHtml(
                  p.problemStatement
                )}</td>
                <td style="border:1px solid #CBD5E1;padding:4px 7px;font-weight:600;">${escapeHtml(
                  p.finalAnswer
                )}</td>
                <td style="border:1px solid #CBD5E1;padding:4px 7px;text-align:right;font-family:monospace;">${
                  p.points
                }</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
        ${
          outputs.answers?.multipleChoiceQuiz?.length
            ? `<div style="font-size:10px;color:#334155;"><b>Сонгох сорилын түлхүүр:</b> ${outputs.answers.multipleChoiceQuiz
                .map(
                  (q) =>
                    `${q.questionNumber}-${optionLetters[q.correctIndex] || 'А'}`
                )
                .join(' · ')}</div>`
            : ''
        }
      </div>`
    : '';

  const studentResultsHtml =
    students.length > 0
      ? `
      <div>
        <div style="font-size:12px;font-weight:800;color:#0F172A;margin-bottom:8px;">5. Хичээлийн үр дүн ба сурагчдын үнэлгээний тайлан (ZipGrade)</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px;">
          <div style="border:1px solid #CBD5E1;border-radius:8px;padding:8px 10px;background:#F8FAFC;">
            <div style="font-size:9.5px;color:#64748B;">Үнэлэгдсэн сурагч</div>
            <div style="font-size:16px;font-weight:800;font-family:monospace;color:#0F172A;">${
              stats.studentCount
            }</div>
          </div>
          <div style="border:1px solid #CBD5E1;border-radius:8px;padding:8px 10px;background:#EEF2FF;">
            <div style="font-size:9.5px;color:#4338CA;">Ангийн дундаж</div>
            <div style="font-size:16px;font-weight:800;font-family:monospace;color:#312E81;">${
              stats.avgFinal
            }%</div>
          </div>
          <div style="border:1px solid #CBD5E1;border-radius:8px;padding:8px 10px;background:#ECFDF5;">
            <div style="font-size:9.5px;color:#047857;">Сургалтын чанар (≥80%)</div>
            <div style="font-size:16px;font-weight:800;font-family:monospace;color:#065F46;">${
              stats.qualityPct
            }%</div>
          </div>
          <div style="border:1px solid #CBD5E1;border-radius:8px;padding:8px 10px;background:#FFF7ED;">
            <div style="font-size:9.5px;color:#C2410C;">Дундаж ахиц дэвшил</div>
            <div style="font-size:16px;font-weight:800;font-family:monospace;color:#9A3412;">${
              stats.avgDelta >= 0 ? '+' : ''
            }${stats.avgDelta}%</div>
          </div>
        </div>

        <table style="width:100%;border-collapse:collapse;font-size:9.8px;">
          <thead>
            <tr style="background:#F1F5F9;">
              <th style="border:1px solid #CBD5E1;padding:5px 7px;text-align:left;">Код</th>
              <th style="border:1px solid #CBD5E1;padding:5px 7px;text-align:left;">Сурагчийн нэр</th>
              <th style="border:1px solid #CBD5E1;padding:5px 7px;text-align:right;">Гараа</th>
              <th style="border:1px solid #CBD5E1;padding:5px 7px;text-align:right;">Явц</th>
              <th style="border:1px solid #CBD5E1;padding:5px 7px;text-align:right;">Төгсгөл</th>
              <th style="border:1px solid #CBD5E1;padding:5px 7px;text-align:right;">Ахиц</th>
              <th style="border:1px solid #CBD5E1;padding:5px 7px;text-align:left;">Рубрик түвшин</th>
            </tr>
          </thead>
          <tbody>
            ${students
              .slice(0, 18)
              .map((stu) => {
                const st = resolveStudentStageScores(stu);
                return `
                  <tr>
                    <td style="border:1px solid #CBD5E1;padding:4px 7px;font-family:monospace;">${escapeHtml(
                      stu.studentCode
                    )}</td>
                    <td style="border:1px solid #CBD5E1;padding:4px 7px;font-weight:600;">${escapeHtml(
                      stu.studentName
                    )}</td>
                    <td style="border:1px solid #CBD5E1;padding:4px 7px;text-align:right;font-family:monospace;">${
                      st.pre
                    }%</td>
                    <td style="border:1px solid #CBD5E1;padding:4px 7px;text-align:right;font-family:monospace;">${
                      st.mid
                    }%</td>
                    <td style="border:1px solid #CBD5E1;padding:4px 7px;text-align:right;font-family:monospace;font-weight:700;">${
                      st.final
                    }%</td>
                    <td style="border:1px solid #CBD5E1;padding:4px 7px;text-align:right;font-family:monospace;color:${
                      st.delta >= 0 ? '#047857' : '#DC2626'
                    };">${st.delta >= 0 ? '+' : ''}${st.delta}%</td>
                    <td style="border:1px solid #CBD5E1;padding:4px 7px;">${escapeHtml(
                      stu.rubricLevel
                    )}</td>
                  </tr>`;
              })
              .join('')}
          </tbody>
        </table>
      </div>`
      : `
      <div style="border:1px solid #E2E8F0;border-radius:8px;padding:12px;background:#F8FAFC;font-size:10.5px;color:#475569;">
        <b>5. Хичээлийн үр дүнгийн тэмдэглэл:</b> ${escapeHtml(
          outputs.report?.teacherReportSummary ||
            'ZipGrade хэсэгт сурагчдын тестийн оноог оруулснаар ангийн амжилт, чанар, ахиц дэвшлийн хүснэгт энд автоматаар нэгтгэгдэнэ.'
        )}
      </div>`;

  return `
    <div class="pdf-a4-page" style="width:794px;min-height:1123px;box-sizing:border-box;background:#FFFFFF;color:#0F172A;padding:36px 40px;font-family:'Manrope',system-ui,-apple-system,sans-serif;font-size:11px;line-height:1.45;display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #E2E8F0;padding-bottom:8px;margin-bottom:14px;font-size:10px;color:#64748B;">
          <span>${escapeHtml(goal.subject)} · ${escapeHtml(goal.grade)} — ${escapeHtml(
    goal.topic
  )}</span>
          <span>Үнэлгээ ба Үр дүнгийн хуудас</span>
        </div>
        ${rubricHtml}
        ${exercisesSummaryHtml}
        ${studentResultsHtml}
      </div>

      <div style="border-top:1px solid #CBD5E1;padding-top:12px;margin-top:20px;display:flex;justify-content:space-between;font-size:10px;color:#475569;">
        <span>Боловсруулсан багш: ........................................</span>
        <span>Хянасан ЗАН-ийн ахлагч: ........................................</span>
      </div>
    </div>
  `;
}

function buildPortfolioCoverPageHtml(
  lessons: Array<{ lesson: SavedLesson; students: GradedStudentRecord[] }>
): string {
  const todayStr = new Date().toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const summaries = lessons.map((item) => ({
    lesson: item.lesson,
    stats: computeLessonResultSummary(item.students),
  }));

  const totalStudents = summaries.reduce((s, x) => s + x.stats.studentCount, 0);
  const gradedItems = summaries.filter((x) => x.stats.studentCount > 0);
  const overallAvg =
    gradedItems.length > 0
      ? Math.round(
          gradedItems.reduce((s, x) => s + x.stats.avgFinal, 0) /
            gradedItems.length
        )
      : 0;
  const overallQuality =
    gradedItems.length > 0
      ? Math.round(
          gradedItems.reduce((s, x) => s + x.stats.qualityPct, 0) /
            gradedItems.length
        )
      : 0;

  return `
    <div class="pdf-a4-page" style="width:794px;min-height:1123px;box-sizing:border-box;background:#FFFFFF;color:#0F172A;padding:42px 44px;font-family:'Manrope',system-ui,-apple-system,sans-serif;font-size:11px;line-height:1.5;display:flex;flex-direction:column;justify-content:space-between;">
      <div>
        <div style="background:linear-gradient(135deg,#0F172A,#1E1B4B);color:#FFFFFF;border-radius:16px;padding:28px 28px;margin-bottom:24px;">
          <div style="font-size:11px;font-weight:700;color:#38BDF8;margin-bottom:6px;">
            AI-87 БАГШИЙН ТУСЛАХ СИСТЕМ · МИНИЙ ХИЧЭЭЛҮҮД ЦАХИМ САН
          </div>
          <div style="font-size:24px;font-weight:800;line-height:1.2;">
            Ээлжит хичээлийн төлөвлөлт ба үр дүнгийн нэгдсэн PDF архив
          </div>
          <div style="margin-top:10px;font-size:11.5px;color:#CBD5E1;">
            Хэвлэсэн огноо: ${escapeHtml(todayStr)} · Нийт архивласан хичээл: ${
    lessons.length
  }
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px;">
          <div style="border:1px solid #CBD5E1;border-radius:10px;padding:12px;background:#F8FAFC;">
            <div style="font-size:10px;color:#64748B;">Нийт хичээл</div>
            <div style="font-size:20px;font-weight:800;font-family:monospace;">${
              lessons.length
            }</div>
          </div>
          <div style="border:1px solid #CBD5E1;border-radius:10px;padding:12px;background:#F0F9FF;">
            <div style="font-size:10px;color:#0369A1;">Үнэлэгдсэн сурагч</div>
            <div style="font-size:20px;font-weight:800;font-family:monospace;color:#0C4A6E;">${totalStudents}</div>
          </div>
          <div style="border:1px solid #CBD5E1;border-radius:10px;padding:12px;background:#EEF2FF;">
            <div style="font-size:10px;color:#4338CA;">Дундаж гүйцэтгэл</div>
            <div style="font-size:20px;font-weight:800;font-family:monospace;color:#312E81;">${overallAvg}%</div>
          </div>
          <div style="border:1px solid #CBD5E1;border-radius:10px;padding:12px;background:#ECFDF5;">
            <div style="font-size:10px;color:#047857;">Дундаж чанар (≥80%)</div>
            <div style="font-size:20px;font-weight:800;font-family:monospace;color:#065F46;">${overallQuality}%</div>
          </div>
        </div>

        <div style="font-size:13px;font-weight:800;margin-bottom:8px;">Архивлагдсан хичээлүүдийн товчоо бүртгэл</div>
        <table style="width:100%;border-collapse:collapse;font-size:10.5px;">
          <thead>
            <tr style="background:#F1F5F9;">
              <th style="border:1px solid #CBD5E1;padding:7px 8px;text-align:center;width:6%;">№</th>
              <th style="border:1px solid #CBD5E1;padding:7px 8px;text-align:left;width:18%;">Судлагдахуун · Анги</th>
              <th style="border:1px solid #CBD5E1;padding:7px 8px;text-align:left;width:36%;">Ээлжит хичээлийн сэдэв</th>
              <th style="border:1px solid #CBD5E1;padding:7px 8px;text-align:right;width:10%;">Сурагч</th>
              <th style="border:1px solid #CBD5E1;padding:7px 8px;text-align:right;width:10%;">Дундаж</th>
              <th style="border:1px solid #CBD5E1;padding:7px 8px;text-align:right;width:10%;">Чанар</th>
              <th style="border:1px solid #CBD5E1;padding:7px 8px;text-align:right;width:10%;">Ахиц</th>
            </tr>
          </thead>
          <tbody>
            ${summaries
              .map(
                ({ lesson, stats }, i) => `
              <tr>
                <td style="border:1px solid #CBD5E1;padding:6px 8px;text-align:center;font-family:monospace;">${
                  i + 1
                }</td>
                <td style="border:1px solid #CBD5E1;padding:6px 8px;font-weight:600;">${escapeHtml(
                  lesson.goal.subject
                )} · ${escapeHtml(lesson.goal.grade)}</td>
                <td style="border:1px solid #CBD5E1;padding:6px 8px;">${escapeHtml(
                  lesson.goal.topic
                )}</td>
                <td style="border:1px solid #CBD5E1;padding:6px 8px;text-align:right;font-family:monospace;">${
                  stats.studentCount
                }</td>
                <td style="border:1px solid #CBD5E1;padding:6px 8px;text-align:right;font-family:monospace;font-weight:700;">${
                  stats.studentCount > 0 ? `${stats.avgFinal}%` : '—'
                }</td>
                <td style="border:1px solid #CBD5E1;padding:6px 8px;text-align:right;font-family:monospace;">${
                  stats.studentCount > 0 ? `${stats.qualityPct}%` : '—'
                }</td>
                <td style="border:1px solid #CBD5E1;padding:6px 8px;text-align:right;font-family:monospace;color:#047857;">${
                  stats.studentCount > 0
                    ? `${stats.avgDelta >= 0 ? '+' : ''}${stats.avgDelta}%`
                    : '—'
                }</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>

      <div style="border-top:1px solid #CBD5E1;padding-top:14px;display:flex;justify-content:space-between;font-size:10.5px;color:#475569;">
        <span>Тайлан нэгтгэсэн багш: ...........................................</span>
        <span>Сургалтын менежер: ...........................................</span>
      </div>
    </div>
  `;
}

async function renderPagesHtmlToPdfDownload(
  pagesHtml: string[],
  filename: string
): Promise<void> {
  const host = document.createElement('div');
  host.style.position = 'fixed';
  host.style.left = '-10000px';
  host.style.top = '0';
  host.style.width = '794px';
  host.style.zIndex = '-1';
  host.style.background = '#FFFFFF';
  document.body.appendChild(host);

  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    for (let i = 0; i < pagesHtml.length; i++) {
      host.innerHTML = pagesHtml[i];
      const pageEl = host.firstElementChild as HTMLElement | null;
      if (!pageEl) continue;

      // Give browser layout 1 frame to settle
      await new Promise((r) => window.requestAnimationFrame(() => r(null)));

      const dataUrl = await toJpeg(pageEl, {
        quality: 0.94,
        pixelRatio: 2,
        backgroundColor: '#FFFFFF',
        cacheBust: true,
      });

      const rect = pageEl.getBoundingClientRect();
      const pageWidthMm = 210;
      const maxPageHeightMm = 297;
      const renderedHeightMm = (rect.height / Math.max(1, rect.width)) * pageWidthMm;

      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }

      if (renderedHeightMm <= maxPageHeightMm) {
        pdf.addImage(dataUrl, 'JPEG', 0, 0, pageWidthMm, renderedHeightMm);
      } else {
        // Scale down slightly to fit cleanly on A4 page if content is tall
        const scale = maxPageHeightMm / renderedHeightMm;
        const scaledWidth = pageWidthMm * scale;
        const offsetX = (pageWidthMm - scaledWidth) / 2;
        pdf.addImage(dataUrl, 'JPEG', offsetX, 0, scaledWidth, maxPageHeightMm);
      }
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(host);
  }
}

export async function downloadSingleLessonArchivePdf(
  lesson: SavedLesson,
  students: GradedStudentRecord[]
): Promise<void> {
  const safeSubject = lesson.goal.subject.replace(/[\\/:*?"<>|()\s]+/g, '_');
  const safeTopic = lesson.goal.topic
    .replace(/[\\/:*?"<>|]+/g, '')
    .trim()
    .slice(0, 28)
    .replace(/\s+/g, '_');
  const filename = `AI-87_${safeSubject}_${lesson.goal.grade.replace(
    /\s+/g,
    ''
  )}_${safeTopic || 'Хичээл'}_Төлөвлөлт_ҮрДүн.pdf`;

  const pages = [
    buildLessonPlanPageHtml(lesson),
    buildLessonResultsPageHtml(lesson, students),
  ];

  await renderPagesHtmlToPdfDownload(pages, filename);
}

export async function downloadPortfolioArchivePdf(
  entries: Array<{ lesson: SavedLesson; students: GradedStudentRecord[] }>
): Promise<void> {
  if (entries.length === 0) return;

  const pages: string[] = [buildPortfolioCoverPageHtml(entries)];
  entries.forEach((entry, idx) => {
    pages.push(
      buildLessonPlanPageHtml(
        entry.lesson,
        `Хичээл #${idx + 1}/${entries.length}`
      )
    );
    pages.push(buildLessonResultsPageHtml(entry.lesson, entry.students));
  });

  const datePart = new Date().toISOString().slice(0, 10);
  const filename = `AI-87_Миний_Хичээлүүд_Нэгдсэн_Архив_${entries.length}хичээл_${datePart}.pdf`;
  await renderPagesHtmlToPdfDownload(pages, filename);
}
