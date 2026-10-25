import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Globe, X } from 'lucide-react';
import { copyTextSafe } from '../utils/clipboard';

interface GoogleSitesEmbedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function resolveDefaultPublicUrl(): string {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  if (origin.includes('://ais-dev-')) {
    return origin.replace('://ais-dev-', '://ais-pre-');
  }
  return origin;
}

export const GoogleSitesEmbedModal: React.FC<GoogleSitesEmbedModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [baseUrl, setBaseUrl] = useState<string>(() => resolveDefaultPublicUrl());
  const [embedTab, setEmbedTab] = useState<'card' | 'iframe'>('card');
  const [iframeHeight, setIframeHeight] = useState<number>(1150);
  const [copiedType, setCopiedType] = useState<'card' | 'iframe' | 'url' | null>(
    null
  );

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/embed-info')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.publicUrl && typeof data.publicUrl === 'string') {
          setBaseUrl(data.publicUrl.replace(/\/+$/, ''));
        }
      })
      .catch(() => {
        // Keep browser origin
      });
  }, [isOpen]);

  const cleanBase = baseUrl.trim().replace(/\/+$/, '');
  const isPreviewProxyUrl = cleanBase.includes('://ais-pre-') || cleanBase.includes('://ais-dev-');

  const launchCardHtml = useMemo(() => {
    return `<div style="font-family:'Segoe UI',system-ui,-apple-system,sans-serif;background:linear-gradient(135deg,#0F172A 0%,#1E293B 55%,#1E1B4B 100%);color:#FFFFFF;border-radius:20px;padding:28px 32px;box-sizing:border-box;max-width:960px;margin:0 auto;box-shadow:0 12px 32px rgba(15,23,42,0.18);">
  <div style="font-size:12px;font-weight:700;color:#38BDF8;letter-spacing:0.02em;margin-bottom:6px;">87 ДУГААР СУРГУУЛЬ · БАГШИЙН УХААЛАГ ТУСЛАХ СИСТЕМ</div>
  <div style="font-size:26px;font-weight:800;line-height:1.25;margin-bottom:10px;">AI-87 — 6 AI Бот, Хичээл Боловсруулагч, ZipGrade ба PDF Архив</div>
  <div style="font-size:14px;color:#CBD5E1;line-height:1.6;margin-bottom:20px;">Дунд болон ахлах ангийн бүх судлагдахуунаар ээлжит хичээлийн судалгаа, слайд, 100 онооны рубрик, шаталсан бодлого дасгал, ZipGrade тестийн үнэлгээ болон PDF архивыг нэг дороос бэлтгэнэ.</div>
  <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:22px;font-size:12px;color:#E2E8F0;">
    <span style="background:rgba(255,255,255,0.1);padding:6px 12px;border-radius:10px;">1. Судалгаа</span>
    <span style="background:rgba(255,255,255,0.1);padding:6px 12px;border-radius:10px;">2. Контент</span>
    <span style="background:rgba(255,255,255,0.1);padding:6px 12px;border-radius:10px;">3. Рубрик ба Тайлан</span>
    <span style="background:rgba(255,255,255,0.1);padding:6px 12px;border-radius:10px;">4. Сорил ба Хариулт</span>
    <span style="background:rgba(255,255,255,0.1);padding:6px 12px;border-radius:10px;">5. Боловсруулагч (.doc)</span>
    <span style="background:rgba(255,255,255,0.1);padding:6px 12px;border-radius:10px;">6. ZipGrade + PDF Архив</span>
  </div>
  <a href="${cleanBase}" target="_blank" rel="noopener noreferrer" style="display:inline-block;background:linear-gradient(90deg,#F97316,#EA580C);color:#FFFFFF;text-decoration:none;font-weight:800;font-size:15px;padding:13px 26px;border-radius:12px;box-shadow:0 6px 18px rgba(249,115,22,0.35);">AI-87 Системийг бүтэн цонхоор нээж ажиллуулах →</a>
</div>`;
  }, [cleanBase]);

  const iframeSnippet = useMemo(() => {
    const embedUrl = `${cleanBase}/?embed=1`;
    return `<iframe src="${embedUrl}" width="100%" height="${iframeHeight}" style="border:0; border-radius:16px; width:100%; min-height:${iframeHeight}px;" allow="clipboard-write; fullscreen" allowfullscreen loading="lazy" title="AI-87 Багшийн Туслах Систем"></iframe>`;
  }, [cleanBase, iframeHeight]);

  if (!isOpen) return null;

  const handleCopy = async (type: 'card' | 'iframe' | 'url', text: string) => {
    const ok = await copyTextSafe(text);
    if (ok) {
      setCopiedType(type);
      window.setTimeout(() => setCopiedType(null), 2000);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-sites-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="text-xs font-bold text-[#EA580C]">
              87 дугаар сургуулийн Google Sites хуудсанд холбох шийдэл
            </div>
            <h2
              id="google-sites-modal-title"
              className="mt-1 text-xl font-extrabold text-slate-900 tracking-tight"
            >
              Google Sites руу «refused to connect» алдаагүй оруулах
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Хаах"
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Explanation of why ais-pre refused to connect */}
        <div className="rounded-2xl bg-amber-50/90 border border-amber-200/80 p-4 space-y-1.5">
          <div className="text-xs font-extrabold text-amber-950">
            Яагаад «ais-pre-...run.app refused to connect» гэж гарсан бэ?
          </div>
          <p className="text-xs text-amber-900 leading-relaxed">
            <code>ais-pre-...</code> эхлэлтэй хаяг нь AI Studio-ийн урьдчилан харах хамгаалалттай прокси тул гадны сайтын <code>&lt;iframe&gt;</code> дотор нээхийг автоматаар хориглодог. Доорх <strong>«Арга 1: Бэлэн Самбар Карт»</strong> кодыг <code>Embed code</code> хэсэгт хуулж тавихад ямар ч алдаагүй шууд гоёмсог самбар гарч ирнэ! Харин хуудас дотор шууд <code>&lt;iframe&gt;</code> ажиллуулах бол баруун дээд булангийн <strong>Deploy → Cloud Run</strong> товчоор нийтэлж шинэ Cloud Run хаягаа ашиглаарай.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl bg-slate-100">
          <button
            type="button"
            onClick={() => setEmbedTab('card')}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              embedTab === 'card'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Арга 1: Бэлэн Самбар Карт (Шууд ажиллана · Зөвлөж буй)
          </button>
          <button
            type="button"
            onClick={() => setEmbedTab('iframe')}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
              embedTab === 'iframe'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Арга 2: Шууд Iframe цонх (Cloud Run Deploy хийсний дараа)
          </button>
        </div>

        {/* Public URL Input */}
        <div>
          <label
            htmlFor="gsites-public-url"
            className="block text-xs font-bold text-slate-700 mb-1.5"
          >
            Апп-ын хаяг (Share эсвэл Cloud Run Deploy хийсэн URL)
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="gsites-public-url"
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs sm:text-sm font-mono text-slate-900 focus:border-[#F97316] focus:bg-white focus:outline-none"
            />
            <button
              type="button"
              onClick={() => handleCopy('url', cleanBase)}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {copiedType === 'url' ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Холбоос хуулагдлаа</span>
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5 text-sky-600" />
                  <span>Холбоос хуулах</span>
                </>
              )}
            </button>
          </div>
        </div>

        {embedTab === 'card' ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800">
                Google Sites → Insert → Embed → «Embed code» таб дээр хуулж тавих код:
              </span>
              <button
                type="button"
                onClick={() => handleCopy('card', launchCardHtml)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {copiedType === 'card' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Самбарын код хуулагдлаа!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Самбарын HTML код хуулах</span>
                  </>
                )}
              </button>
            </div>

            {/* Live visual preview of how the card looks inside Google Sites */}
            <div className="rounded-2xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#1E1B4B] text-white p-5 space-y-2.5">
              <div className="text-[11px] font-bold text-sky-400">
                87 ДУГААР СУРГУУЛЬ · БАГШИЙН УХААЛАГ ТУСЛАХ СИСТЕМ (Харагдах байдал)
              </div>
              <div className="text-base sm:text-lg font-extrabold">
                AI-87 — 6 AI Бот, Хичээл Боловсруулагч, ZipGrade ба PDF Архив
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Энэхүү самбар Google Sites дотор ямар ч «refused to connect» алдаагүй шууд харагдах ба багш нар товч дээр дармагц AI-87 систем бүтэн дэлгэцээр нээгдэнэ.
              </p>
              <div className="pt-1">
                <span className="inline-block px-4 py-2 rounded-xl bg-[#F97316] text-xs font-extrabold text-white">
                  AI-87 Системийг бүтэн цонхоор нээж ажиллуулах →
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {isPreviewProxyUrl && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 text-xs text-rose-900">
                Анхаар: Одоогийн хаяг <code>ais-pre-...</code> байгаа тул шууд iframe-ээр тавихад Google Sites дээр хориглоно. Эхлээд AI Studio-ийн баруун дээд булангийн <strong>Deploy → Deploy to Cloud Run</strong> товчийг дарж авсан шинэ <code>.run.app</code> хаягаа дээрх нүдэнд тавиад доорх кодыг хуулаарай.
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600">Өндөр:</span>
                {[950, 1150, 1400].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setIframeHeight(h)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono tabular-nums font-bold cursor-pointer ${
                      iframeHeight === h
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {h}px
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleCopy('iframe', iframeSnippet)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {copiedType === 'iframe' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Iframe код хуулагдлаа!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Iframe код хуулах</span>
                  </>
                )}
              </button>
            </div>

            <pre className="rounded-2xl bg-slate-900 text-slate-100 p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
              {iframeSnippet}
            </pre>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <a
            href={cleanBase}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 hover:text-sky-900 underline underline-offset-4 whitespace-nowrap"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Холбоосыг шинэ цонхонд шалгаж үзэх</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            Хаах
          </button>
        </div>
      </div>
    </div>
  );
};
