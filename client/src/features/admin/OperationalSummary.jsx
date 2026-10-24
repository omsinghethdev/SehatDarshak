import { Link } from 'react-router';
import { PATHS } from '../../routes/paths';
import { cn } from '../../utils/cn';

const TILES = [
  { key: 'activeTokens', label: 'Active queue tokens', help: 'Waiting, called, or in consultation' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'called', label: 'Called' },
  { key: 'inConsultation', label: 'In consultation' },
  { key: 'openRequests', label: 'Open assistance requests' },
];

function StatTile({ label, value, help, className }) {
  return (
    <div className={cn('rounded-xl border border-line bg-white p-4 sm:p-5', className)}>
      <dt className="text-sm font-medium text-slate-700">{label}</dt>
      <dd className="mt-1 text-3xl font-semibold text-slate-900">{value}</dd>
      {help && <dd className="mt-1 text-xs text-slate-600">{help}</dd>}
    </div>
  );
}

/** Counts row plus a department table; numbers only, no charts. */
export function OperationalSummary({ summary }) {
  return (
    <div className="space-y-8">
      <section aria-labelledby="totals-heading">
        <h2 id="totals-heading" className="text-xl font-bold text-slate-900">
          Totals across all departments
        </h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {TILES.map((tile, index) => (
            <StatTile
              key={tile.key}
              label={tile.label}
              value={summary[tile.key]}
              help={tile.help}
              className={index === 0 ? 'col-span-2 sm:col-span-1' : undefined}
            />
          ))}
        </dl>
      </section>

      <section aria-labelledby="departments-heading" className="space-y-4">
        <h2 id="departments-heading" className="text-xl font-bold text-slate-900">
          Queue by department
        </h2>
        {/* Phones: one card per department instead of a sideways-scrolling table. */}
        <ul className="space-y-3 sm:hidden">
          {summary.departments.map((department) => (
            <li key={department.id} className="rounded-xl border border-line bg-white p-4">
              <h3 className="font-semibold text-slate-900">
                {department.name} <span className="font-normal text-slate-600">({department.code})</span>
              </h3>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {[
                  ['Waiting', department.waiting],
                  ['Called', department.called],
                  ['In consultation', department.inConsultation],
                  ['Active total', department.active],
                  ['Open requests', department.openRequests],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-baseline justify-between gap-2 border-b border-line pb-1">
                    <dt className="text-slate-600">{label}</dt>
                    <dd className="font-semibold text-slate-900 tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
              <Link
                to={`${PATHS.staffQueue}?department=${encodeURIComponent(department.id)}`}
                className="mt-2 inline-flex min-h-11 items-center font-semibold text-brand-800 underline underline-offset-4"
              >
                View queue<span className="sr-only"> for {department.name}</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="relative hidden overflow-x-auto rounded-xl border border-line bg-white sm:block">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">
              Active queue tokens and open assistance requests for each department
            </caption>
            <thead className="border-b border-line bg-canvas-muted text-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Department</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Waiting</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Called</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">In consultation</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Active total</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Open requests</th>
                <th scope="col" className="px-4 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {summary.departments.map((department) => (
                <tr key={department.id}>
                  <th scope="row" className="px-4 py-3 font-semibold text-slate-900">
                    {department.name} <span className="font-normal text-slate-600">({department.code})</span>
                  </th>
                  <td className="px-4 py-3 text-right">{department.waiting}</td>
                  <td className="px-4 py-3 text-right">{department.called}</td>
                  <td className="px-4 py-3 text-right">{department.inConsultation}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">{department.active}</td>
                  <td className="px-4 py-3 text-right">{department.openRequests}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`${PATHS.staffQueue}?department=${encodeURIComponent(department.id)}`}
                      className="inline-flex min-h-11 items-center font-semibold text-brand-800 underline underline-offset-4"
                    >
                      View queue<span className="sr-only"> for {department.name}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
