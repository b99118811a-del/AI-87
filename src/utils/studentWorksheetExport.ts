import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import type {
  LessonGoal,
  LessonOutputs,
  StudentWorksheetData,
} from '../types';

export interface WorksheetSectionFlags {
  includeMatching: boolean;
  includeFillBlanks: boolean;
  includeGuidedTasks: boolean;
  includeTieredProblems: boolean;
  includeQuiz: boolean;
  includeSelfCheck: boolean;
  includeHints: boolean;
}

export const DEFAULT_WORKSHEET_FLAGS: WorksheetSectionFlags = {
  includeMatching: true,
  includeFillBlanks: true,
  includeGuidedTasks: true,
  includeTieredProblems: true,
  includeQuiz: true,
  includeSelfCheck: true,
  includeHints: false,
};

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Deterministically shuffles matching definitions for the student copy
 * so column B isn't trivially 1->А, 2->Б, 3->В, 4->Г.
 */
export function getShuffledDefinitions(
  pairs: Array<{ term: string; definition: string }>
): Array<{ letter: string; definition: string; originalIndex: number }> {
  const letters = ['А', 'Б', 'В', 'Г', 'Д', 'Е'];
  const indexed = pairs.map((p, idx) => ({
    definition: p.definition,
    originalIndex: idx,
  }));
  // Deterministic rotation/swap so order differs from 0,1,2,3
  if (indexed.length >= 4) {
    const reordered = [indexed[2], indexed[0], indexed[3], indexed[1], ...indexed.slice(4)];
    return reordered.map((item, i) => ({
      letter: letters[i] || String(i + 1),
      definition: item.definition,
      originalIndex: item.originalIndex,
    }));
  }
  if (indexed.length >= 2) {
    const reversed = [...indexed].reverse();
    return reversed.map((item, i) => ({
      letter: letters[i] || String(i + 1),
      definition: item.definition,
      originalIndex: item.originalIndex,
    }));
  }
  return indexed.map((item, i) => ({
    letter: letters[i] || String(i + 1),
    definition: item.definition,
    originalIndex: item.originalIndex,
  }));
}

/**
 * Synthesizes an immediate classroom-ready Student Worksheet directly from
 * the Lesson Plan (Bot 5) + Research (Bot 1) + Content (Bot 2) outputs.
 */
export function synthesizeWorksheetFromLessonPlan(
  goal: LessonGoal,
  outputs: LessonOutputs,
  variantLabel: string = 'А хувилбар'
): StudentWorksheetData {
  const matchingPairs =
    outputs.research?.keyConcepts?.slice(0, 4).map((c) => ({
      term: c.term,
      definition: c.definition,
    })) || [];

  const fillBlanks =
    outputs.research?.keyConcepts?.slice(0, 4).map((c) => ({
      sentenceWithBlank: `«................» гэдэг нь ${c.definition.charAt(0).toLowerCase()}${c.definition.slice(1)}`,
      missingWord: c.term,
    })) || [];

  const plannerStages = outputs.planner?.stagesTable || [];
  const middleStages =
    plannerStages.length >= 3
      ? plannerStages.slice(1, 4)
      : plannerStages.slice(0, 3);

  const guidedTasks =
    middleStages.length > 0
      ? middleStages.map((st) => ({
          stageTitle: st.stageName,
          prompt: `${st.studentActivity} (Зорилт: ${st.learningObjective})`,
          expectedAnswer: st.assessmentCheck,
        }))
      : outputs.content?.interactiveActivity
      ? [
          {
            stageTitle: outputs.content.interactiveActivity.title,
            prompt: outputs.content.interactiveActivity.instructions.join(' '),
            expectedAnswer: outputs.content.lessonObjective,
          },
        ]
      : [];

  return {
    title: `Сурагчийн даалгаврын хуудас: ${goal.topic}`,
    variantLabel,
    studentInstructions:
      'Даалгавар бүрийн зааврыг анхааралтай уншиж, бодолт болон тайлбараа зориулалтын зайд гаргацтай бичээрэй.',
    matchingPairs,
    fillBlanks,
    guidedTasks,
  };
}

export function buildWorksheetFullHtml(
  goal: LessonGoal,
  outputs: LessonOutputs,
  worksheet: StudentWorksheetData,
  flags: WorksheetSectionFlags,
  showTeacherKey: boolean
): { page1Html: string; page2Html: string; combinedWordBodyHtml: string } {
  const letters = ['А', 'Б', 'В', 'Г', 'Д'];
  const shuffledDefs = getShuffledDefinitions(worksheet.matchingPairs);

  let sectionCounter = 0;

  // Section: Matching
  const matchingHtml =
    flags.includeMatching && worksheet.matchingPairs.length > 0
      ? (() => {
          sectionCounter++;
          return `
          <div style="margin-bottom:14px;">
            <div style="font-size:11.5px;font-weight:800;color:#0F172A;margin-bottom:6px;">
              ${sectionCounter}. Түлхүүр ухагдахууныг зөв тодорхойлолттой нь харгалзуулна уу.
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:10px;">
              <thead>
                <tr style="background:#F8FAFC;">
                  <th style="border:1px solid #94A3B8;padding:5px 8px;text-align:left;width:32%;">Ухагдахуун</th>
                  <th style="border:1px solid #94A3B8;padding:5px 8px;text-align:left;width:54%;">Тодорхойлолт</th>
                  <th style="border:1px solid #94A3B8;padding:5px 8px;text-align:center;width:14%;">Хариу</th>
                </tr>
              </thead>
              <tbody>
                ${worksheet.matchingPairs
                  .map((pair, idx) => {
                    const defRow = shuffledDefs[idx];
                    const matchingLetter =
                      shuffledDefs.find((d) => d.originalIndex === idx)?.letter ||
                      'А';
                    return `
                      <tr>
                        <td style="border:1px solid #94A3B8;padding:6px 8px;font-weight:700;">${
                          idx + 1
                        }. ${escapeHtml(pair.term)}</td>
                        <td style="border:1px solid #94A3B8;padding:6px 8px;"><b>${
                          defRow ? defRow.letter : letters[idx]
                        })</b> ${escapeHtml(
                      defRow ? defRow.definition : pair.definition
                    )}</td>
                        <td style="border:1px solid #94A3B8;padding:6px 8px;text-align:center;font-family:monospace;font-weight:700;color:${
                          showTeacherKey ? '#047857' : '#0F172A'
                        };">
                          ${
                            showTeacherKey
                              ? `${idx + 1} → ${matchingLetter}`
                              : `${idx + 1} → ......`
                          }
                        </td>
                      </tr>`;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>`;
        })()
      : '';

  // Section: Fill in the blanks
  const fillBlanksHtml =
    flags.includeFillBlanks && worksheet.fillBlanks.length > 0
      ? (() => {
          sectionCounter++;
          return `
          <div style="margin-bottom:14px;">
            <div style="font-size:11.5px;font-weight:800;color:#0F172A;margin-bottom:6px;">
              ${sectionCounter}. Цэгийн оронд тохирох түлхүүр үг, ухагдахууныг нөхөж бичнэ үү.
            </div>
            <div style="border:1px solid #94A3B8;border-radius:8px;padding:8px 12px;font-size:10.5px;">
              ${worksheet.fillBlanks
                .map((fb, idx) => {
                  const renderedSentence = showTeacherKey
                    ? escapeHtml(fb.sentenceWithBlank).replace(
                        /\.{4,}/g,
                        `<b style="color:#047857;text-decoration:underline;">${escapeHtml(
                          fb.missingWord
                        )}</b>`
                      )
                    : escapeHtml(fb.sentenceWithBlank);
                  return `<div style="margin-bottom:${
                    idx === worksheet.fillBlanks.length - 1 ? '0' : '6px'
                  };"><b>${idx + 1})</b> ${renderedSentence} ${
                    showTeacherKey && !fb.sentenceWithBlank.includes('....')
                      ? `<b style="color:#047857;">[${escapeHtml(
                          fb.missingWord
                        )}]</b>`
                      : ''
                  }</div>`;
                })
                .join('')}
            </div>
          </div>`;
        })()
      : '';

  // Section: Guided Lesson Plan Tasks
  const guidedTasksHtml =
    flags.includeGuidedTasks && worksheet.guidedTasks.length > 0
      ? (() => {
          sectionCounter++;
          return `
          <div style="margin-bottom:14px;">
            <div style="font-size:11.5px;font-weight:800;color:#0F172A;margin-bottom:6px;">
              ${sectionCounter}. Хичээлийн явцын чиглүүлэгтэй даалгавар (Төлөвлөгөөний дагуу)
            </div>
            ${worksheet.guidedTasks
              .slice(0, 3)
              .map(
                (gt, idx) => `
              <div style="border:1px solid #94A3B8;border-radius:8px;padding:8px 11px;margin-bottom:8px;font-size:10.2px;">
                <div style="font-weight:700;color:#0F172A;margin-bottom:3px;">
                  Алхам ${idx + 1} (${escapeHtml(gt.stageTitle)}): <span style="font-weight:500;">${escapeHtml(
                  gt.prompt
                )}</span>
                </div>
                ${
                  showTeacherKey
                    ? `<div style="color:#047857;background:#ECFDF5;padding:5px 8px;border-radius:6px;margin-top:4px;"><b>Хүлээгдэж буй үр дүн / Шалгуур:</b> ${escapeHtml(
                        gt.expectedAnswer
                      )}</div>`
                    : `<div style="margin-top:8px;border-bottom:1px dashed #94A3B8;height:16px;"></div>
                       <div style="margin-top:8px;border-bottom:1px dashed #94A3B8;height:16px;"></div>`
                }
              </div>`
              )
              .join('')}
          </div>`;
        })()
      : '';

  // Section: Tiered Problems (Bot 6)
  const problemsList = outputs.exercises?.problems || [];
  const tieredProblemsHtml =
    flags.includeTieredProblems && problemsList.length > 0
      ? (() => {
          sectionCounter++;
          return `
          <div style="margin-bottom:14px;">
            <div style="font-size:11.5px;font-weight:800;color:#0F172A;margin-bottom:6px;">
              ${sectionCounter}. Шаталсан бие даах бодлого, дасгал (А — Суурь, Б — Хэрэглээ, В — Ахисан)
            </div>
            ${problemsList
              .slice(0, 4)
              .map(
                (p) => `
              <div style="border:1px solid #94A3B8;border-radius:8px;padding:8px 11px;margin-bottom:8px;font-size:10.2px;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">
                  <b>[${escapeHtml(p.code)}] ${escapeHtml(p.tier)}</b>
                  <span style="font-family:monospace;font-weight:700;">[${
                    p.points
                  } оноо]</span>
                </div>
                <div>${escapeHtml(p.problemStatement)}</div>
                ${
                  flags.includeHints && p.hint
                    ? `<div style="font-size:9.5px;color:#475569;margin-top:3px;"><i>Санамж: ${escapeHtml(
                        p.hint
                      )}</i></div>`
                    : ''
                }
                ${
                  showTeacherKey
                    ? `<div style="margin-top:5px;padding:5px 8px;background:#ECFDF5;border-radius:6px;color:#065F46;">
                        <b>Бодолт:</b> ${escapeHtml(p.stepByStepSolution)}<br/>
                        <b>Хариу:</b> ${escapeHtml(p.finalAnswer)}
                      </div>`
                    : `<div style="margin-top:8px;border-bottom:1px dashed #94A3B8;height:15px;"></div>
                       <div style="margin-top:8px;border-bottom:1px dashed #94A3B8;height:15px;"></div>
                       <div style="margin-top:6px;font-size:9.5px;font-weight:700;">Хариу: .......................................................</div>`
                }
              </div>`
              )
              .join('')}
          </div>`;
        })()
      : '';

  // Section: Quick Quiz (Bot 4)
  const quizList = outputs.answers?.multipleChoiceQuiz || [];
  const quizHtml =
    flags.includeQuiz && quizList.length > 0
      ? (() => {
          sectionCounter++;
          return `
          <div style="margin-bottom:14px;">
            <div style="font-size:11.5px;font-weight:800;color:#0F172A;margin-bottom:6px;">
              ${sectionCounter}. Мэдлэг бататгах сонгох сорил (Зөв хариултын өмнөх нүдийг будна уу)
            </div>
            <div style="border:1px solid #94A3B8;border-radius:8px;padding:8px 11px;font-size:10px;">
              ${quizList
                .slice(0, 5)
                .map(
                  (q) => `
                <div style="margin-bottom:7px;">
                  <div style="font-weight:700;margin-bottom:2px;">${
                    q.questionNumber
                  }. ${escapeHtml(q.question)}</div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 12px;padding-left:8px;">
                    ${q.options
                      .map((opt, oIdx) => {
                        const isAns = showTeacherKey && oIdx === q.correctIndex;
                        return `<div style="${
                          isAns ? 'color:#047857;font-weight:700;' : ''
                        }">${isAns ? '☑' : '☐'} ${
                          letters[oIdx] || oIdx + 1
                        }) ${escapeHtml(opt)}</div>`;
                      })
                      .join('')}
                  </div>
                </div>`
                )
                .join('')}
            </div>
          </div>`;
        })()
      : '';

  // Section: Self-Check & Homework
  const selfCheckHtml = flags.includeSelfCheck
    ? (() => {
        sectionCounter++;
        const hw = outputs.report?.homeworkAssignment;
        return `
        <div>
          <div style="font-size:11.5px;font-weight:800;color:#0F172A;margin-bottom:6px;">
            ${sectionCounter}. Сурагчийн өөрийн үнэлгээ ба Гэрийн даалгавар
          </div>
          <table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:8px;">
            <tbody>
              <tr>
                <td style="border:1px solid #94A3B8;padding:6px 8px;width:33%;">☐ Хичээлээ бүрэн ойлгосон</td>
                <td style="border:1px solid #94A3B8;padding:6px 8px;width:34%;">☐ Дахин бататгах хэрэгтэй</td>
                <td style="border:1px solid #94A3B8;padding:6px 8px;width:33%;">☐ Багшаас тусламж авна</td>
              </tr>
              <tr>
                <td colspan="3" style="border:1px solid #94A3B8;padding:6px 8px;">
                  Өнөөдрийн хичээлээс хамгийн чухал сурч авсан 1 зүйл: ....................................................................................
                </td>
              </tr>
            </tbody>
          </table>
          ${
            hw
              ? `<div style="border:1px solid #94A3B8;background:#F8FAFC;border-radius:8px;padding:7px 10px;font-size:10px;">
                  <b>Гэрийн даалгавар (${hw.estimatedMinutes} мин):</b> ${escapeHtml(
                  hw.task
                )}
                </div>`
              : ''
          }
        </div>`;
      })()
    : '';

  const headerBannerHtml = `
    <div style="border:2px solid #0F172A;border-radius:10px;padding:12px 16px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;font-weight:700;color:#334155;margin-bottom:4px;">
        <span>СУРАГЧИЙН ДААЛГАВРЫН ХУУДАС · ${escapeHtml(
          worksheet.variantLabel
        )} ${showTeacherKey ? '(БАГШИЙН ТҮЛХҮҮР)' : ''}</span>
        <span>${escapeHtml(goal.subject)} · ${escapeHtml(goal.grade)} · ${
    goal.durationMinutes
  } минут</span>
      </div>
      <div style="font-size:16px;font-weight:800;color:#0F172A;margin-bottom:8px;">
        Сэдэв: ${escapeHtml(goal.topic)}
      </div>
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:8px;font-size:10px;border-top:1px solid #CBD5E1;padding-top:8px;">
        <div>Сурагчийн нэр: ..........................................</div>
        <div>Анги, бүлэг: ..............</div>
        <div>Огноо: ....................</div>
        <div style="text-align:right;font-weight:700;">Оноо: ....... / 100</div>
      </div>
    </div>
    <div style="font-size:10px;color:#475569;margin-bottom:12px;font-style:italic;">
      Заавар: ${escapeHtml(worksheet.studentInstructions)}
    </div>
  `;

  const page1Html = `
    <div class="pdf-a4-page" style="width:794px;min-height:1123px;box-sizing:border-box;background:#FFFFFF;color:#0F172A;padding:34px 38px;font-family:'Manrope',system-ui,-apple-system,sans-serif;line-height:1.45;">
      ${headerBannerHtml}
      ${matchingHtml}
      ${fillBlanksHtml}
      ${guidedTasksHtml}
    </div>
  `;

  const hasSecondPageContent = Boolean(
    tieredProblemsHtml || quizHtml || selfCheckHtml
  );

  const page2Html = hasSecondPageContent
    ? `
    <div class="pdf-a4-page" style="width:794px;min-height:1123px;box-sizing:border-box;background:#FFFFFF;color:#0F172A;padding:34px 38px;font-family:'Manrope',system-ui,-apple-system,sans-serif;line-height:1.45;">
      <div style="display:flex;justify-content:space-between;font-size:9.5px;color:#64748B;border-bottom:1px solid #CBD5E1;padding-bottom:6px;margin-bottom:12px;">
        <span>${escapeHtml(goal.subject)} · ${escapeHtml(goal.grade)} — ${escapeHtml(
        goal.topic
      )}</span>
        <span>Даалгаврын хуудас (2-р нүүр)</span>
      </div>
      ${tieredProblemsHtml}
      ${quizHtml}
      ${selfCheckHtml}
    </div>`
    : '';

  const combinedWordBodyHtml = `
    ${headerBannerHtml}
    ${matchingHtml}
    ${fillBlanksHtml}
    ${guidedTasksHtml}
    ${tieredProblemsHtml}
    ${quizHtml}
    ${selfCheckHtml}
  `;

  return { page1Html, page2Html, combinedWordBodyHtml };
}

export async function downloadStudentWorksheetPdf(
  goal: LessonGoal,
  outputs: LessonOutputs,
  worksheet: StudentWorksheetData,
  flags: WorksheetSectionFlags,
  showTeacherKey: boolean
): Promise<void> {
  const { page1Html, page2Html } = buildWorksheetFullHtml(
    goal,
    outputs,
    worksheet,
    flags,
    showTeacherKey
  );
  const pages = page2Html ? [page1Html, page2Html] : [page1Html];

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

    for (let i = 0; i < pages.length; i++) {
      host.innerHTML = pages[i];
      const el = host.firstElementChild as HTMLElement | null;
      if (!el) continue;

      await new Promise((r) => window.requestAnimationFrame(() => r(null)));

      const dataUrl = await toJpeg(el, {
        quality: 0.94,
        pixelRatio: 2,
        backgroundColor: '#FFFFFF',
        cacheBust: true,
      });

      const rect = el.getBoundingClientRect();
      const pageWidthMm = 210;
      const maxPageHeightMm = 297;
      const renderedHeightMm = (rect.height / Math.max(1, rect.width)) * pageWidthMm;

      if (i > 0) pdf.addPage('a4', 'portrait');

      if (renderedHeightMm <= maxPageHeightMm) {
        pdf.addImage(dataUrl, 'JPEG', 0, 0, pageWidthMm, renderedHeightMm);
      } else {
        const scale = maxPageHeightMm / renderedHeightMm;
        const scaledW = pageWidthMm * scale;
        pdf.addImage(
          dataUrl,
          'JPEG',
          (pageWidthMm - scaledW) / 2,
          0,
          scaledW,
          maxPageHeightMm
        );
      }
    }

    const safeSubj = goal.subject.replace(/[\\/:*?"<>|()\s]+/g, '_');
    const safeTopic = goal.topic
      .replace(/[\\/:*?"<>|]+/g, '')
      .trim()
      .slice(0, 26)
      .replace(/\s+/g, '_');
    const suffix = showTeacherKey ? 'Багшийн_Түлхүүр' : 'Даалгаврын_Хуудас';
    pdf.save(`AI-87_${safeSubj}_${goal.grade.replace(/\s+/g, '')}_${safeTopic}_${suffix}.pdf`);
  } finally {
    document.body.removeChild(host);
  }
}

export function downloadStudentWorksheetWord(
  goal: LessonGoal,
  outputs: LessonOutputs,
  worksheet: StudentWorksheetData,
  flags: WorksheetSectionFlags,
  showTeacherKey: boolean
): void {
  const { combinedWordBodyHtml } = buildWorksheetFullHtml(
    goal,
    outputs,
    worksheet,
    flags,
    showTeacherKey
  );

  const htmlDoc = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(worksheet.title)}</title>
<style>
  @page { size: A4 portrait; margin: 1.5cm; }
  body { font-family: "Times New Roman", Arial, sans-serif; color: #000000; font-size: 11pt; }
  table { border-collapse: collapse; width: 100%; }
</style>
</head>
<body>
${combinedWordBodyHtml}
</body>
</html>`;

  const blob = new Blob(['\ufeff', htmlDoc], {
    type: 'application/msword;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeSubj = goal.subject.replace(/[\\/:*?"<>|()\s]+/g, '_');
  const suffix = showTeacherKey ? 'Багшийн_Түлхүүр' : 'Даалгаврын_Хуудас';
  a.href = url;
  a.download = `AI-87_${safeSubj}_${goal.grade.replace(/\s+/g, '')}_${suffix}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
