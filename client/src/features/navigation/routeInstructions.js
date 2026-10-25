/*
 * Turns route steps from the API (structured: kind, turn, side, floors) into sentences in the
 * current language. Room and floor names are service data and are shown as received.
 */

const WALK_KEYS = {
  depart: 'walkDepart',
  left: 'walkLeft',
  right: 'walkRight',
  back: 'walkBack',
  straight: 'walkStraight',
};
const DEPART_TURN_KEYS = { left: 'walkDepartLeft', right: 'walkDepartRight', back: 'walkDepartBack' };
const SIDE_KEYS = { left: 'sideLeft', right: 'sideRight', ahead: 'sideAhead' };

const distance = (metres) => Math.max(1, Math.round(metres ?? 0));

function floorName(route, floorId) {
  return route.floors?.find((floor) => floor.id === floorId)?.displayName ?? floorId;
}

function departPlace(route, step, t) {
  if (step.departFrom === 'lift') return t('directions.places.lift');
  if (step.departFrom === 'stairs') return t('directions.places.stairs');
  return route.from.displayName;
}

function withSide(text, side, t) {
  return SIDE_KEYS[side] ? `${text} ${t(`directions.steps.${SIDE_KEYS[side]}`)}` : text;
}

/** One instruction sentence for `step` of `route`. */
export function describeStep(step, route, t) {
  switch (step.kind) {
    case 'start':
      return t('directions.steps.start', { place: route.from.displayName, floor: floorName(route, step.floorId) });
    case 'walk': {
      const params = { distance: distance(step.metres) };
      if (step.departFrom && step.turn === 'depart') {
        return t('directions.steps.walkDepart', { ...params, place: departPlace(route, step, t) });
      }
      if (step.departFrom && DEPART_TURN_KEYS[step.turn]) {
        return t(`directions.steps.${DEPART_TURN_KEYS[step.turn]}`, { ...params, place: departPlace(route, step, t) });
      }
      return t(`directions.steps.${WALK_KEYS[step.turn] ?? 'walkStraight'}`, params);
    }
    case 'lift':
    case 'stairs': {
      const key = `${step.kind}${step.direction === 'down' ? 'Down' : 'Up'}`;
      return withSide(t(`directions.steps.${key}`, { floor: floorName(route, step.toFloorId) }), step.side, t);
    }
    case 'arrive':
      return withSide(t('directions.steps.arrive', { place: route.to.displayName }), step.side, t);
    default:
      return '';
  }
}

/** "About 86 m · about 2 min" style summary parts. */
export function routeSummary(route, t) {
  return {
    distance: t('directions.summary.distance', { distance: distance(route.metres) }),
    time: t('directions.summary.time', { count: route.estimatedMinutes }),
  };
}
