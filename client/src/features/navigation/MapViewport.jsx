import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Expand, LocateFixed, ZoomIn, ZoomOut } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import { clampViewBox, fitViewBox, zoomViewBox } from './routeView';

const CONTROL = 'inline-flex size-11 items-center justify-center rounded-lg border border-slate-400 bg-white text-slate-800 hover:border-brand-700 hover:bg-brand-50';
const DRAG_THRESHOLD_PX = 5;

function ControlButton({ label, icon: Icon, onClick, disabled }) {
  return (
    <button type="button" onClick={onClick} aria-disabled={disabled || undefined} title={label} className={cn(CONTROL, disabled && 'cursor-not-allowed opacity-50')}>
      <Icon aria-hidden="true" className="size-5" />
      <span className="sr-only">{label}</span>
    </button>
  );
}

/**
 * Zoom and pan for a floor map, done with the SVG viewBox (no extra library). The view fits
 * `focusPoints` whenever `focusKey` changes (a new route, step, or floor). Dragging pans only
 * while zoomed in, and every drag has a button alternative. `renderMap` receives the viewBox,
 * whether the view is zoomed, and pointer handlers for the map frame.
 * `followPoint` (the simulated position) is kept in view: when it nears the edge, the view is
 * re-centred on it without changing the zoom.
 */
export function MapViewport({ floor, focusPoints, focusKey, followPoint = null, renderMap }) {
  const { t } = useTranslation();
  const whole = { x: 0, y: 0, width: floor.width, height: floor.height };
  const [box, setBox] = useState(() => fitViewBox(floor, focusPoints));
  const pointsRef = useRef(focusPoints);
  useEffect(() => {
    pointsRef.current = focusPoints;
  });

  useEffect(() => {
    setBox(fitViewBox(floor, pointsRef.current));
  }, [floor, focusKey]);

  const followX = followPoint?.x;
  const followY = followPoint?.y;
  useEffect(() => {
    if (!Number.isFinite(followX) || !Number.isFinite(followY)) return;
    setBox((current) => {
      const marginX = current.width * 0.12;
      const marginY = current.height * 0.12;
      const inside =
        followX >= current.x + marginX &&
        followX <= current.x + current.width - marginX &&
        followY >= current.y + marginY &&
        followY <= current.y + current.height - marginY;
      // Returning the same box leaves the view (and React) untouched.
      return inside ? current : clampViewBox(floor, { ...current, x: followX - current.width / 2, y: followY - current.height / 2 });
    });
  }, [floor, followX, followY]);

  const zoomed = box.width < floor.width - 0.5;
  const drag = useRef(null);
  const suppressClick = useRef(false);

  function pan(dx, dy) {
    setBox((current) => clampViewBox(floor, { ...current, x: current.x + dx * current.width, y: current.y + dy * current.height }));
  }

  function handlePointerDown(event) {
    if (!zoomed || event.button !== 0) return;
    const frameWidth = event.currentTarget.clientWidth || 1;
    drag.current = { startX: event.clientX, startY: event.clientY, box, scale: box.width / frameWidth, moved: false };
    suppressClick.current = false;

    function move(moveEvent) {
      const state = drag.current;
      if (!state) return;
      const dx = moveEvent.clientX - state.startX;
      const dy = moveEvent.clientY - state.startY;
      if (!state.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      state.moved = true;
      setBox(clampViewBox(floor, { ...state.box, x: state.box.x - dx * state.scale, y: state.box.y - dy * state.scale }));
    }
    function up() {
      // A drag must not also select the room it ended on.
      suppressClick.current = Boolean(drag.current?.moved);
      drag.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  function handleClickCapture(event) {
    if (suppressClick.current) {
      event.stopPropagation();
      event.preventDefault();
      suppressClick.current = false;
    }
  }

  const frameProps = { onPointerDown: handlePointerDown, onClickCapture: handleClickCapture, style: zoomed ? { cursor: 'grab' } : undefined };

  return (
    <div className="space-y-3">
      <div role="group" aria-label={t('directions.map.controls')} className="flex flex-wrap items-center gap-2">
        <ControlButton label={t('directions.map.zoomIn')} icon={ZoomIn} onClick={() => setBox((current) => zoomViewBox(floor, current, 1.5))} disabled={box.width <= floor.width / 4 + 0.5} />
        <ControlButton label={t('directions.map.zoomOut')} icon={ZoomOut} onClick={() => setBox((current) => zoomViewBox(floor, current, 1 / 1.5))} disabled={!zoomed} />
        {focusPoints?.length > 0 && (
          <ControlButton label={t('directions.map.fitRoute')} icon={LocateFixed} onClick={() => setBox(fitViewBox(floor, focusPoints))} />
        )}
        <ControlButton label={t('directions.map.wholeFloor')} icon={Expand} onClick={() => setBox(whole)} disabled={!zoomed} />
        {zoomed && (
          <>
            <span aria-hidden="true" className="mx-1 h-8 w-px bg-line" />
            <ControlButton label={t('directions.map.panLeft')} icon={ArrowLeft} onClick={() => pan(-0.25, 0)} />
            <ControlButton label={t('directions.map.panUp')} icon={ArrowUp} onClick={() => pan(0, -0.25)} />
            <ControlButton label={t('directions.map.panDown')} icon={ArrowDown} onClick={() => pan(0, 0.25)} />
            <ControlButton label={t('directions.map.panRight')} icon={ArrowRight} onClick={() => pan(0.25, 0)} />
          </>
        )}
      </div>
      {zoomed && <p className="text-sm text-slate-600">{t('directions.map.dragHint')}</p>}
      {renderMap({ viewBox: box, zoomed, frameProps })}
    </div>
  );
}
