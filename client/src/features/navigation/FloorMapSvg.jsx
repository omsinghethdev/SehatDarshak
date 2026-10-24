import { useId } from 'react';
import { LocationMarker } from './LocationGlyph';
import { useTranslation } from '../../hooks/useTranslation';
import { LOCATION_TYPES, getLocationType, hasValidGeometry, typeLabel } from './locationTypes';

const LABEL_FONT_SIZE = 19;
const LINE_HEIGHT = 22;
const MARKER_SIZE = 34;
const PADDING = 12;
const MARKER_GAP = 8;
// Approximate average glyph width for the semibold system UI font, measured in the browser.
const CHAR_WIDTH = LABEL_FONT_SIZE * 0.5;

/**
 * Lay out a location's label inside its rectangle. SVG has no automatic text wrapping, so
 * words are wrapped greedily: the first line sits beside the numbered marker and later lines
 * use the full width below it. Text that still does not fit ends with "…"; the full name is
 * always available in the details panel, the list, and the accessible label.
 *
 * @returns {Array<{ text: string, x: number, y: number }>} one entry per line (y = baseline)
 */
function labelLines(item) {
  const left = item.x + PADDING;
  const besideMarkerX = left + MARKER_SIZE + MARKER_GAP;
  const right = item.x + item.width - PADDING;
  const belowTop = item.y + PADDING + MARKER_SIZE + 4;
  const linesBelow = Math.max(0, Math.floor((item.y + item.height - PADDING - belowTop) / LINE_HEIGHT));

  const slots = [
    { x: besideMarkerX, y: item.y + PADDING + MARKER_SIZE / 2 + LABEL_FONT_SIZE * 0.35 },
    ...Array.from({ length: linesBelow }, (_, index) => ({
      x: left,
      y: belowTop + LABEL_FONT_SIZE * 0.85 + index * LINE_HEIGHT,
    })),
  ].map((slot) => ({ ...slot, maxChars: Math.max(1, Math.floor((right - slot.x) / CHAR_WIDTH)) }));

  const words = String(item.displayName).split(/\s+/).filter(Boolean);
  const lines = [];
  let slotIndex = 0;
  let current = '';

  for (let i = 0; i < words.length && slotIndex < slots.length; ) {
    const candidate = current ? `${current} ${words[i]}` : words[i];
    if (candidate.length <= slots[slotIndex].maxChars) {
      current = candidate;
      i += 1;
    } else if (current) {
      lines.push({ ...slots[slotIndex], text: current });
      current = '';
      slotIndex += 1;
    } else if (slotIndex === 0 && slots.length > 1) {
      // A long first word does not fit beside the marker; start below it instead.
      slotIndex = 1;
    } else {
      // A single word longer than the line: cut it.
      lines.push({ ...slots[slotIndex], text: `${words[i].slice(0, slots[slotIndex].maxChars - 1)}…` });
      current = '';
      slotIndex += 1;
      i += 1;
    }
  }
  if (current && slotIndex < slots.length) lines.push({ ...slots[slotIndex], text: current });

  const shownWords = lines.map((line) => line.text).join(' ').split(/\s+/).length;
  const truncated = shownWords < words.length && lines.length > 0 && !lines.at(-1).text.endsWith('…');
  if (truncated) {
    const last = lines.at(-1);
    last.text = `${last.text.slice(0, Math.max(1, last.maxChars - 1))}…`;
  }
  return lines;
}

function PatternDefs({ prefix }) {
  return (
    <defs>
      {Object.entries(LOCATION_TYPES).map(([key, type]) => {
        if (type.pattern === 'stripes') {
          return (
            <pattern key={key} id={`${prefix}-${key}`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="14" height="14" fill={type.fill} />
              <line x1="0" y1="0" x2="0" y2="14" stroke={type.stroke} strokeOpacity="0.28" strokeWidth="5" />
            </pattern>
          );
        }
        if (type.pattern === 'dots') {
          return (
            <pattern key={key} id={`${prefix}-${key}`} width="16" height="16" patternUnits="userSpaceOnUse">
              <rect width="16" height="16" fill={type.fill} />
              <circle cx="8" cy="8" r="2.6" fill={type.stroke} fillOpacity="0.38" />
            </pattern>
          );
        }
        return null;
      })}
    </defs>
  );
}

function fillFor(prefix, roomType, type) {
  return LOCATION_TYPES[roomType] && type.pattern !== 'solid' ? `url(#${prefix}-${roomType})` : type.fill;
}

function MapLocation({ item, number, prefix, selected, onSelect }) {
  const { t } = useTranslation();
  const type = getLocationType(item.roomType);
  const lines = labelLines(item);

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(item.id);
    }
  }

  return (
    <g
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${number}. ${item.displayName}, ${typeLabel(type, t)}`}
      onClick={() => onSelect(item.id)}
      onKeyDown={handleKeyDown}
      className="group cursor-pointer outline-none"
    >
      {/* Keyboard focus ring, drawn outside the room so it never hides the selection border. */}
      <rect
        x={item.x - 9}
        y={item.y - 9}
        width={item.width + 18}
        height={item.height + 18}
        rx="10"
        fill="none"
        stroke="var(--color-focus)"
        strokeWidth="6"
        className="opacity-0 group-focus-visible:opacity-100"
      />
      <rect
        x={item.x}
        y={item.y}
        width={item.width}
        height={item.height}
        rx="6"
        fill={fillFor(prefix, item.roomType, type)}
        stroke={selected ? '#0f172a' : type.stroke}
        strokeWidth={selected ? 7 : 2.5}
        strokeDasharray={type.dashed ? '8 6' : undefined}
        className="transition-[stroke-width] group-hover:[stroke-width:5]"
      />
      <LocationMarker
        cx={item.x + PADDING + MARKER_SIZE / 2}
        cy={item.y + PADDING + MARKER_SIZE / 2}
        size={MARKER_SIZE}
        marker={type.marker}
        color={selected ? '#0f172a' : type.stroke}
        number={number}
      />
      <text
        aria-hidden="true"
        fontSize={LABEL_FONT_SIZE}
        fontWeight={selected ? 700 : 600}
        fill="#0f172a"
        className="pointer-events-none"
      >
        {lines.map((line, index) => (
          <tspan key={index} x={line.x} y={line.y}>
            {line.text}
          </tspan>
        ))}
      </text>
    </g>
  );
}

/**
 * Interactive 2D floor plan. The SVG viewBox uses the floor's own map units (top-left origin),
 * so locations are drawn at their documented coordinates and the plan scales to the
 * container width without distortion.
 */
export function FloorMapSvg({ floor, numbering, selectedId, onSelect }) {
  const { t } = useTranslation();
  const prefix = `map${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const drawable = floor.locations.filter(hasValidGeometry);

  return (
    // Below 640px the plan keeps a minimum width (rooms stay readable and at least ~44px tall
    // to tap) and scrolls sideways inside this frame instead of shrinking.
    <div className="relative overflow-x-auto rounded-lg border border-line bg-white">
      <svg
        viewBox={`0 0 ${floor.width} ${floor.height}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={t('map.svgLabel', { floor: floor.displayName, count: drawable.length })}
        className="block h-auto w-full min-w-[40rem]"
      >
        <PatternDefs prefix={prefix} />
        <rect
          aria-hidden="true"
          x="20"
          y="20"
          width={floor.width - 40}
          height={floor.height - 40}
          rx="12"
          fill="#faf7f2"
          stroke="#94a3b8"
          strokeWidth="3"
        />
        {drawable.map((item) => (
          <MapLocation
            key={item.id}
            item={item}
            number={numbering.get(item.id)}
            prefix={prefix}
            selected={item.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </svg>
    </div>
  );
}
