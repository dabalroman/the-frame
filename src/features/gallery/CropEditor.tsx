import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Check, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { aspectH, autoCrop, clampCrop, orientedFrame } from '@/lib/crop';
import type { Crop, FrameImage, Orientation } from '@/types/image';

// Ported from random-tools' eink-frame CropEditor.tsx (#185). The canvas scene math,
// pan/pinch/wheel handlers, oversize/≥2-edge invariant, and per-orientation save flow
// are identical. Only the visual layer differs: warm light tokens, i18n strings, the
// canvas literals re-themed (terracotta frame / espresso backdrop), and the endpoint
// paths (`/api/eink/...` → `/api/...`, named preview → `/api/photo/:name`).

type Props = {
  image: FrameImage | null;
  frameWidth: number;
  frameHeight: number;
  initialOrientation?: Orientation;
  onClose: () => void;
  onDelete: (image: FrameImage) => void;
  onCropSaved: () => void;
};

const ORIENTATIONS: Orientation[] = ['horizontal', 'vertical'];

const MARGIN = 20;            // px gap kept between the crop frame and the canvas edges
const PRIMARY = '#e56943';    // theme primary (terracotta) — canvas can't read CSS variables
const CANVAS_BG = '#e9e2d6';  // soft warm parchment — low-contrast backdrop behind the image
const DIM = 'rgba(40,33,28,0.42)'; // gentle warm scrim over the area outside the crop frame

type Layout = {
  imgLeft: number; imgTop: number; imgW: number; imgH: number;
  cropLeft: number; cropTop: number; cropW: number; cropH: number;
};

// Map the scene into canvas pixels. The whole image is the backdrop; the crop frame is drawn
// over it and may extend past the image (oversize → white shows in the gap). We scale so that
// BOTH the image and the crop frame fit with a margin on every side. Thanks to the ≥2-edge
// invariant the frame and image are nested per axis, so the union extent is just
// max(1, cropW) × max(1, cropH) (image-normalized) — independent of pan position, so the scale
// stays steady while dragging.
function computeLayout(nat: { w: number; h: number }, c: Crop, view: { w: number; h: number }): Layout {
  const unionW = Math.max(1, c.w) * nat.w;
  const unionH = Math.max(1, c.h) * nat.h;
  const availW = Math.max(1, view.w - 2 * MARGIN);
  const availH = Math.max(1, view.h - 2 * MARGIN);
  const s = Math.min(availW / unionW, availH / unionH);
  const ox = MARGIN + (availW - unionW * s) / 2;  // top-left of the centred union bbox
  const oy = MARGIN + (availH - unionH * s) / 2;
  const ux0 = Math.min(0, c.x);  // union origin in image-normalized coords
  const uy0 = Math.min(0, c.y);
  return {
    imgLeft:  ox + (0 - ux0) * nat.w * s,
    imgTop:   oy + (0 - uy0) * nat.h * s,
    imgW:     nat.w * s,
    imgH:     nat.h * s,
    cropLeft: ox + (c.x - ux0) * nat.w * s,
    cropTop:  oy + (c.y - uy0) * nat.h * s,
    cropW:    c.w * nat.w * s,
    cropH:    c.h * nat.h * s,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CropEditor({ image, frameWidth, frameHeight, initialOrientation = 'horizontal', onClose, onDelete, onCropSaved }: Props) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Orientation>(initialOrientation);
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [editCrop, setEditCrop] = useState<Crop | null>(null);
  // Per-orientation override for just-saved / just-removed crops, until the parent refresh
  // lands: a Crop means "just saved", null means "just removed", undefined means "use prop".
  const [confirmed, setConfirmed] = useState<Partial<Record<Orientation, Crop | null>>>({});
  const [nat,         setNat]         = useState<{ w: number; h: number } | null>(null);
  const [einkView,    setEinkView]    = useState(false);
  const [previewBust, setPreviewBust] = useState(0);
  // Measured pixel size of the canvas area, so we can scale the scene to fit the image and
  // the (possibly oversize) crop frame within it, leaving a margin on every side.
  const [view,        setView]        = useState<{ w: number; h: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef    = useRef<HTMLImageElement>(null);  // hidden source <img>, drawn onto the canvas
  const sceneRef  = useRef<{ imgW: number; imgH: number } | null>(null);  // for pan px→normalized
  const roRef     = useRef<ResizeObserver | null>(null);
  const ptrsRef   = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef  = useRef<number | null>(null);

  const tabLabel = (o: Orientation) => t(`gallery.orientation.${o}`);

  // Callback ref for the canvas area: fires when the node actually attaches (Radix mounts the
  // dialog's portal content after the component's effects run, so an empty-deps effect would
  // miss it). Measures immediately and on every resize.
  const setBodyRef = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect();
    roRef.current = null;
    if (!el) return;
    const update = () => setView({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    roRef.current = ro;
  }, []);

  // The hidden source <img>'s onLoad records natural dims, which (re)triggers the draw effect.
  function handleImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
  }

  function frameFor(o: Orientation) {
    return orientedFrame(o, frameWidth, frameHeight);
  }

  // Saved crop for an orientation: local override wins over the (possibly stale) prop.
  function savedCropFor(o: Orientation): Crop | undefined {
    const c = confirmed[o];
    if (c !== undefined) return c ?? undefined;
    return image?.crops?.[o];
  }

  const activeHasCrop = savedCropFor(activeTab) !== undefined;

  function enterEdit() {
    if (!nat) return;
    const { fw, fh } = frameFor(activeTab);
    const base = savedCropFor(activeTab) ?? autoCrop(nat.w, nat.h, fw, fh);
    setEditCrop(clampCrop(base, nat.w, nat.h, fw, fh));
    setEditing(true);
    setEinkView(false);
  }

  function cancelEdit() {
    setEditing(false);
    setEditCrop(null);
  }

  function selectTab(o: Orientation) {
    if (o === activeTab) return;
    cancelEdit();
    setEinkView(false);
    setActiveTab(o);
  }

  async function saveEdit() {
    if (!editCrop || !image) return;
    setSaving(true);
    try {
      await fetch(`/api/images/${encodeURIComponent(image.name)}/crop?orientation=${activeTab}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crop: editCrop }),
      });
      setConfirmed(c => ({ ...c, [activeTab]: editCrop }));
      setPreviewBust(b => b + 1);
      onCropSaved();
      cancelEdit();
    } finally {
      setSaving(false);
    }
  }

  async function removeCrop() {
    if (!image) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/images/${encodeURIComponent(image.name)}/crop?orientation=${activeTab}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setConfirmed(c => ({ ...c, [activeTab]: null }));
        setPreviewBust(b => b + 1);
        onCropSaved();
        cancelEdit();
      }
    } finally {
      setSaving(false);
    }
  }

  // ── Pointer handlers ─────────────────────────────────────────────────────────
  // In edit mode the crop RECT moves; the image never transforms.

  const onPtrDown = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    ptrsRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinchRef.current = null;
  }, []);

  const onPtrMove = useCallback((e: React.PointerEvent) => {
    const ptrs = ptrsRef.current;
    if (!ptrs.has(e.pointerId) || !nat) return;

    const prev = ptrs.get(e.pointerId)!;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const { fw, fh } = orientedFrame(activeTab, frameWidth, frameHeight);
    // px → normalized image fraction: divide by the image's on-screen size (= nat·scale).
    const scene = sceneRef.current;
    const cw = scene?.imgW ?? fw;
    const ch = scene?.imgH ?? fh;

    if (ptrs.size === 1) {
      // Pan: move the crop rect in drag direction.
      const dx = (e.clientX - prev.x) / cw;
      const dy = (e.clientY - prev.y) / ch;
      setEditCrop(c => c ? clampCrop({ ...c, x: c.x + dx, y: c.y + dy }, nat.w, nat.h, fw, fh) : c);
    } else if (ptrs.size >= 2) {
      // Pinch: resize crop rect from its centre.
      const ids = [...ptrs.keys()];
      const p1 = ptrs.get(ids[0]!)!;
      const p2 = ptrs.get(ids[1]!)!;
      const d = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (pinchRef.current !== null) {
        const prev_d = pinchRef.current;
        setEditCrop(c => {
          if (!c) return c;
          // Pinch OUT (d > prev_d) → crop rect shrinks (zoom in view).
          const ratio = prev_d / d;
          const cx = c.x + c.w / 2;
          const cy = c.y + c.h / 2;
          const newW = c.w * ratio;
          const newH = aspectH(newW, nat.w, nat.h, fw, fh);
          return clampCrop({ x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH }, nat.w, nat.h, fw, fh);
        });
      }
      pinchRef.current = d;
    }
  }, [nat, activeTab, frameWidth, frameHeight]);

  const onPtrUp = useCallback((e: React.PointerEvent) => {
    ptrsRef.current.delete(e.pointerId);
    if (ptrsRef.current.size < 2) pinchRef.current = null;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (!nat) return;
    e.preventDefault();
    const { fw, fh } = orientedFrame(activeTab, frameWidth, frameHeight);
    // Scroll up (deltaY < 0) → zoom in → crop rect shrinks.
    const factor = e.deltaY > 0 ? 1.08 : 0.92;
    setEditCrop(c => {
      if (!c) return c;
      const cx = c.x + c.w / 2;
      const cy = c.y + c.h / 2;
      const newW = c.w * factor;
      const newH = aspectH(newW, nat.w, nat.h, fw, fh);
      return clampCrop({ x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH }, nat.w, nat.h, fw, fh);
    });
  }, [nat, activeTab, frameWidth, frameHeight]);

  // Which crop rect to show: live edit crop, then the saved crop for the active tab, else the
  // auto-crop seed so an empty tab has a sensible centred default to adjust from. Memoized so
  // the draw effect below has a stable dependency.
  const displayCrop = useMemo<Crop | null>(() => {
    if (editing) return editCrop;
    const override = confirmed[activeTab];
    const saved = override !== undefined ? (override ?? undefined) : image?.crops?.[activeTab];
    if (saved) return saved;
    if (!nat) return null;
    const { fw, fh } = orientedFrame(activeTab, frameWidth, frameHeight);
    return autoCrop(nat.w, nat.h, fw, fh);
  }, [editing, editCrop, confirmed, activeTab, image, nat, frameWidth, frameHeight]);

  // Draw the scene onto the canvas: warm backdrop → white paper (crop region) → whole image →
  // dim outside the crop frame → frame border. Redraws whenever the crop, measurements, or
  // source change. No CSS layout involved — every position is computed in computeLayout().
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !view) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(view.w * dpr);
    canvas.height = Math.round(view.h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, view.w, view.h);

    const im = imgRef.current;
    if (!nat || !displayCrop || !im || !im.complete || im.naturalWidth === 0) { sceneRef.current = null; return; }
    const L = computeLayout(nat, displayCrop, view);
    sceneRef.current = { imgW: L.imgW, imgH: L.imgH };

    ctx.fillStyle = '#ffffff';                                  // paper behind the crop region
    ctx.fillRect(L.cropLeft, L.cropTop, L.cropW, L.cropH);
    ctx.drawImage(im, L.imgLeft, L.imgTop, L.imgW, L.imgH);     // whole image as backdrop

    ctx.fillStyle = DIM;                                        // dim everything outside the frame
    const bottom = L.cropTop + L.cropH, right = L.cropLeft + L.cropW;
    ctx.fillRect(0, 0, view.w, Math.max(0, L.cropTop));
    ctx.fillRect(0, bottom, view.w, Math.max(0, view.h - bottom));
    ctx.fillRect(0, L.cropTop, Math.max(0, L.cropLeft), L.cropH);
    ctx.fillRect(right, L.cropTop, Math.max(0, view.w - right), L.cropH);

    ctx.strokeStyle = PRIMARY;                                  // frame border (dashed = unsaved seed)
    ctx.lineWidth = 2;
    ctx.setLineDash(activeHasCrop || editing ? [] : [6, 4]);
    ctx.strokeRect(L.cropLeft + 1, L.cropTop + 1, Math.max(0, L.cropW - 2), Math.max(0, L.cropH - 2));
  }, [view, nat, displayCrop, editing, activeHasCrop, einkView]);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (!image) return null;

  const { fw, fh } = frameFor(activeTab);

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-[95vw] h-[90dvh] max-h-[90dvh] translate-x-[-50%] translate-y-[-50%] overflow-hidden rounded-2xl border border-border bg-card shadow-lifted duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 flex flex-col">
          <DialogTitle className="sr-only">{image.name}</DialogTitle>

        {/* Orientation tabs */}
        <div className="flex items-stretch border-b border-border bg-card shrink-0">
          {ORIENTATIONS.map(o => {
            const has = savedCropFor(o) !== undefined;
            return (
              <button
                key={o}
                onClick={() => selectTab(o)}
                className={`flex-1 px-4 py-3 text-sm font-semibold transition-colors ${
                  o === activeTab
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tabLabel(o)}
                <span className={`ml-2 ${has ? 'text-primary' : 'text-muted-foreground/40'}`}>
                  {has ? '●' : '○'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Canvas — the whole image is the backdrop; the crop frame is drawn over it with a
            margin so it never touches the modal edges (and an oversize frame, larger than the
            image, stays fully visible with white paper filling the part outside the image). */}
        <div
          ref={setBodyRef}
          className="relative flex-1 min-h-0 overflow-hidden bg-foreground/10"
          style={{ cursor: editing ? 'move' : 'default', touchAction: editing ? 'none' : undefined }}
          onPointerDown={editing ? onPtrDown : undefined}
          onPointerMove={editing ? onPtrMove : undefined}
          onPointerUp={editing ? onPtrUp : undefined}
          onPointerCancel={editing ? onPtrUp : undefined}
          onWheel={editing ? onWheel : undefined}
        >
          {/* Hidden source image — kept mounted so it loads; drawn onto the canvas. */}
          <img
            ref={imgRef}
            src={`/api/images/${encodeURIComponent(image.name)}`}
            alt=""
            onLoad={handleImgLoad}
            aria-hidden
            draggable={false}
            style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
          />
          {einkView && !editing ? (
            <img
              src={`/api/photo/${encodeURIComponent(image.name)}?w=${fw}&h=${fh}&orientation=${activeTab}${previewBust ? `&v=${previewBust}` : ''}`}
              alt={image.name}
              draggable={false}
              className="absolute inset-0 w-full h-full object-contain select-none"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            />
          ) : (
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
          )}

          {/* Bottom-center overlay badge: the drag hint while editing, otherwise the
              "{orientation} · not set" note when this orientation has no saved crop. */}
          {(editing || !activeHasCrop) && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-3">
              <span className="max-w-[90%] rounded-full bg-foreground/70 px-3 py-1 text-center text-xs font-semibold text-background backdrop-blur-sm">
                {editing ? t('gallery.dragHint') : `${tabLabel(activeTab)} · ${t('gallery.notSet')}`}
              </span>
            </div>
          )}
        </div>

        {/* Footer bar: optional hint + actions. On mobile the buttons form an even 2-col
            grid (the primary action spans the full width when the count is odd); on sm+
            they collapse to a single right-aligned row. */}
        <div className="px-4 py-3 border-t border-border bg-card flex flex-col gap-2 shrink-0">
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            {editing ? (
              <>
                {activeHasCrop && (
                  <Button size="sm" variant="outline" onClick={removeCrop} disabled={saving} className="w-full sm:w-auto">
                    <Trash2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                    {t('gallery.removeCrop')}
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving} className="w-full sm:w-auto">
                  <X className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                  {t('gallery.cancel')}
                </Button>
                {/* odd count (remove+cancel+save) → save spans both columns on mobile */}
                <Button size="sm" variant="default" onClick={saveEdit} disabled={saving} className={`w-full sm:w-auto ${activeHasCrop ? 'col-span-2 sm:col-span-1' : ''}`}>
                  <Check className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                  {saving ? t('gallery.saving') : t('gallery.saveCrop')}
                </Button>
              </>
            ) : activeHasCrop ? (
              // Top row: preview / crop · Bottom row: delete / close
              <>
                <Button size="sm" variant={einkView ? 'default' : 'outline'} onClick={() => setEinkView(v => !v)} className="w-full sm:w-auto">
                  {t('gallery.einkPreview')}
                </Button>
                <Button size="sm" variant="outline" onClick={enterEdit} disabled={!nat} className="w-full sm:w-auto">
                  <Pencil className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                  {t('gallery.crop')}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => { onDelete(image); onClose(); }} className="w-full sm:w-auto">
                  <Trash2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                  {t('gallery.delete')}
                </Button>
                <Button size="sm" variant="default" onClick={onClose} className="w-full sm:w-auto">
                  {t('gallery.close')}
                </Button>
              </>
            ) : (
              // No crop yet: "Add crop" spans the top row; delete / close on the bottom.
              <>
                <Button size="sm" variant="outline" onClick={enterEdit} disabled={!nat} className="w-full sm:w-auto col-span-2 sm:col-span-1">
                  <Pencil className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                  {t('gallery.addCrop')}
                </Button>
                <Button size="sm" variant="destructive" onClick={() => { onDelete(image); onClose(); }} className="w-full sm:w-auto">
                  <Trash2 className="w-4 h-4 shrink-0" strokeWidth={1.5} />
                  {t('gallery.delete')}
                </Button>
                <Button size="sm" variant="default" onClick={onClose} className="w-full sm:w-auto">
                  {t('gallery.close')}
                </Button>
              </>
            )}
          </div>
        </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
