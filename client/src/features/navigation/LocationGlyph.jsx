/**
 * Numbered marker drawn in SVG coordinates. The shape (circle, square, diamond) encodes the
 * location type, so it is recognisable without colour. Used on the map and in the list.
 */
export function LocationMarker({ cx, cy, size, marker, color, number }) {
  const half = size / 2;
  let shape;
  if (marker === 'square') {
    shape = <rect x={cx - half} y={cy - half} width={size} height={size} rx={size * 0.12} fill={color} />;
  } else if (marker === 'diamond') {
    const r = half * 1.25;
    shape = <polygon points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`} fill={color} />;
  } else {
    shape = <circle cx={cx} cy={cy} r={half} fill={color} />;
  }

  return (
    <g aria-hidden="true">
      {shape}
      {number !== undefined && (
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#ffffff"
          fontSize={size * 0.58}
          fontWeight="700"
        >
          {number}
        </text>
      )}
    </g>
  );
}

/** Small standalone marker for lists and the legend. */
export function LocationGlyph({ type, number, className }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className ?? 'size-8 shrink-0'}>
      <LocationMarker cx={16} cy={16} size={24} marker={type.marker} color={type.stroke} number={number} />
    </svg>
  );
}
