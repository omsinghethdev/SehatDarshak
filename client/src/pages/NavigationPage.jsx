import { useCallback, useMemo } from 'react';
import { MapPinOff } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { Button } from '../components/common/Button';
import { Container } from '../components/common/Container';
import { EmptyState } from '../components/feedback/EmptyState';
import { ErrorState } from '../components/feedback/ErrorState';
import { LoadingState } from '../components/feedback/LoadingState';
import { Notice } from '../components/feedback/Notice';
import { departmentService } from '../features/departments/departmentService';
import { FloorMapSvg } from '../features/navigation/FloorMapSvg';
import { FloorSelector } from '../features/navigation/FloorSelector';
import { LocationDetails } from '../features/navigation/LocationDetails';
import { LocationList } from '../features/navigation/LocationList';
import { MapLegend } from '../features/navigation/MapLegend';
import { navigationService } from '../features/navigation/navigationService';
import { useAsyncData } from '../hooks/useAsyncData';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

function isUsableFloorMap(floor) {
  return (
    floor &&
    Number.isFinite(floor.width) &&
    Number.isFinite(floor.height) &&
    floor.width > 0 &&
    floor.height > 0 &&
    Array.isArray(floor.locations)
  );
}

function FloorMapSection({ floorState, departments, selectedId, onSelect, onClear }) {
  const { status, data: floor, error, reload } = floorState;

  const numbering = useMemo(
    () => new Map((floor?.locations ?? []).map((location, index) => [location.id, index + 1])),
    [floor],
  );
  const departmentsById = useMemo(
    () => (departments.data ? new Map(departments.data.map((item) => [item.id, item])) : null),
    [departments.data],
  );

  if (status === 'error') return <ErrorState error={error} onRetry={reload} />;
  if (status === 'loading' || !floor) return <LoadingState label="Loading floor map…" />;

  if (!isUsableFloorMap(floor)) {
    return (
      <EmptyState
        icon={MapPinOff}
        title="This floor map cannot be shown"
        description="The map information for this floor is incomplete. Please ask hospital staff for help finding your way."
      />
    );
  }

  if (floor.locations.length === 0) {
    return (
      <EmptyState
        icon={MapPinOff}
        title={`No locations have been mapped on the ${floor.displayName} yet`}
        description="Please ask hospital staff for help finding rooms on this floor."
      />
    );
  }

  const selected = floor.locations.find((location) => location.id === selectedId) ?? null;
  const departmentsState = { ...departments, data: departmentsById };

  return (
    <div className="space-y-10">
      {selectedId && !selected && (
        <Notice tone="info" title="Location not found on this floor">
          The location in your link is not on the {floor.displayName}. Choose a location below.
        </Notice>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section aria-labelledby="floor-map-heading" className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="floor-map-heading" className="text-xl font-bold text-slate-900">
              {floor.displayName} map
            </h2>
            <p className="text-sm text-slate-600">Select a numbered location to see its details.</p>
          </div>
          <FloorMapSvg floor={floor} numbering={numbering} selectedId={selected?.id} onSelect={onSelect} />
          <MapLegend />
        </section>

        <div className="lg:sticky lg:top-24">
          <LocationDetails
            location={selected}
            number={selected ? numbering.get(selected.id) : undefined}
            floor={floor}
            departments={departmentsState}
            onClear={onClear}
          />
        </div>
      </div>

      <LocationList
        floor={floor}
        numbering={numbering}
        selectedId={selected?.id}
        departmentsById={departmentsById}
        onSelect={onSelect}
      />
    </div>
  );
}

export function NavigationPage() {
  useDocumentTitle('Hospital map');
  const { isMockAuth } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const loadFloors = useCallback((signal) => navigationService.listFloors({ signal }), []);
  const floors = useAsyncData(loadFloors);

  // Department names are optional detail: a failure here must not block the map.
  const loadDepartments = useCallback((signal) => departmentService.listDepartments({ signal }), []);
  const departments = useAsyncData(loadDepartments);

  const floorList = floors.data ?? [];
  const requestedFloorId = searchParams.get('floor');
  const floorId = floorList.some((floor) => floor.id === requestedFloorId)
    ? requestedFloorId
    : floorList[0]?.id ?? null;
  const selectedId = searchParams.get('location');

  const loadFloorMap = useCallback(
    (signal) => (floorId ? navigationService.getFloorMap(floorId, { signal }) : Promise.resolve(null)),
    [floorId],
  );
  const floorMap = useAsyncData(loadFloorMap);
  // Ignore a previous floor's data while the newly selected floor loads.
  const floorState =
    floorMap.data && floorMap.data.id !== floorId ? { ...floorMap, status: 'loading', data: null } : floorMap;

  const updateParams = useCallback(
    (next) => setSearchParams(Object.fromEntries(Object.entries(next).filter(([, value]) => value)), { replace: true }),
    [setSearchParams],
  );
  const selectFloor = (id) => updateParams({ floor: id });
  const selectLocation = (id) => updateParams({ floor: floorId, location: id === selectedId ? null : id });
  const clearLocation = () => updateParams({ floor: floorId });

  let content;
  if (floors.status === 'error') {
    content = <ErrorState error={floors.error} onRetry={floors.reload} />;
  } else if (!floors.data) {
    content = <LoadingState label="Loading floors…" />;
  } else if (floorList.length === 0) {
    content = (
      <EmptyState
        icon={MapPinOff}
        title="No floor maps are available"
        description="Please ask hospital staff for help finding your way."
        action={<Button variant="secondary" onClick={floors.reload}>Check again</Button>}
      />
    );
  } else {
    content = (
      <div className="space-y-8">
        <FloorSelector floors={floorList} selectedFloorId={floorId} onSelect={selectFloor} />
        <FloorMapSection
          floorState={floorState}
          departments={departments}
          selectedId={selectedId}
          onSelect={selectLocation}
          onClear={clearLocation}
        />
      </div>
    );
  }

  return (
    <Container className="space-y-8 py-10 sm:py-14">
      <div>
        <p className="text-sm font-semibold tracking-wide text-brand-700 uppercase">Hospital information</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Hospital map</h1>
        <p className="mt-2 max-w-2xl text-slate-700">
          Find departments, consultation rooms, and facilities on each floor.
        </p>
      </div>

      <div className="space-y-3">
        {isMockAuth && (
          <Notice tone="warning" title="Demo map">
            The floors and locations shown here are fictional demo data. They do not show a real
            hospital.
          </Notice>
        )}
        <Notice tone="info" title="Location map only">
          This map shows where places are. It does not give verified directions or step-by-step
          routes. If you need help getting somewhere, please ask hospital staff.
        </Notice>
      </div>

      {content}
    </Container>
  );
}
