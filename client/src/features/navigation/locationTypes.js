import { Building2, FlaskConical, MapPin, Stethoscope } from 'lucide-react';

/**
 * Visual encoding for map location types. Each type differs by marker shape, fill pattern,
 * and text label as well as colour, so it can be told apart without colour vision.
 * Colours come from the design tokens (brand, amber, sky, slate).
 */
export const LOCATION_TYPES = Object.freeze({
  consultation: {
    label: 'Consultation room',
    icon: Stethoscope,
    marker: 'circle',
    pattern: 'solid',
    patternLabel: 'plain fill, round marker',
    fill: '#eef6f1',
    stroke: '#1f5f3f',
  },
  facility: {
    label: 'Facility',
    icon: Building2,
    marker: 'square',
    pattern: 'stripes',
    patternLabel: 'striped fill, square marker',
    fill: '#fffbeb',
    stroke: '#b45309',
  },
  diagnostic: {
    label: 'Diagnostic service',
    icon: FlaskConical,
    marker: 'diamond',
    pattern: 'dots',
    patternLabel: 'dotted fill, diamond marker',
    fill: '#f0f9ff',
    stroke: '#0369a1',
  },
});

const OTHER_TYPE = Object.freeze({
  icon: MapPin,
  marker: 'circle',
  pattern: 'solid',
  patternLabel: 'plain fill, round marker',
  fill: '#f8fafc',
  stroke: '#475569',
});

function humanize(value) {
  const text = String(value).replace(/[_-]+/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Type presentation for a `roomType`; unknown values are shown as-is rather than guessed. */
export function getLocationType(roomType) {
  if (LOCATION_TYPES[roomType]) return LOCATION_TYPES[roomType];
  return { ...OTHER_TYPE, dashed: true, label: roomType ? humanize(roomType) : 'Type not specified' };
}

/** True when a location has the numeric geometry needed to draw it. */
export function hasValidGeometry(item) {
  return ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(item?.[key])) && item.width > 0 && item.height > 0;
}
