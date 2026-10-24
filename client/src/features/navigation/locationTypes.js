import { Building2, FlaskConical, MapPin, Stethoscope } from 'lucide-react';

/**
 * Visual encoding for map location types. Each type differs by marker shape, fill pattern,
 * and text label as well as colour, so it can be told apart without colour vision.
 * Colours come from the design tokens (brand, amber, sky, slate).
 */
export const LOCATION_TYPES = Object.freeze({
  consultation: {
    label: 'Consultation room',
    labelKey: 'map.types.consultation',
    patternLabelKey: 'map.patterns.round',
    icon: Stethoscope,
    marker: 'circle',
    pattern: 'solid',
    patternLabel: 'plain fill, round marker',
    fill: '#eef6f1',
    stroke: '#1f5f3f',
  },
  facility: {
    label: 'Facility',
    labelKey: 'map.types.facility',
    patternLabelKey: 'map.patterns.square',
    icon: Building2,
    marker: 'square',
    pattern: 'stripes',
    patternLabel: 'striped fill, square marker',
    fill: '#fffbeb',
    stroke: '#b45309',
  },
  diagnostic: {
    label: 'Diagnostic service',
    labelKey: 'map.types.diagnostic',
    patternLabelKey: 'map.patterns.diamond',
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
  return roomType
    ? { ...OTHER_TYPE, dashed: true, label: humanize(roomType) }
    : { ...OTHER_TYPE, dashed: true, label: 'Type not specified', labelKey: 'map.types.unspecified' };
}

/**
 * Display label in the current language. Unknown room types from the service have no
 * translation and are shown as received (humanised), never guessed.
 */
export function typeLabel(type, t) {
  return type.labelKey ? t(type.labelKey, { defaultValue: type.label }) : type.label;
}

/** True when a location has the numeric geometry needed to draw it. */
export function hasValidGeometry(item) {
  return ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(item?.[key])) && item.width > 0 && item.height > 0;
}
