import { Link } from 'react-router';
import { PATHS } from '../../routes/paths';

const TILES = [
  { key: 'activeTokens', label: 'Active queue tokens', help: 'Waiting, called, or in consultation' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'called', label: 'Called' },
  { key: 'inConsultation', label: 'In consultation' },
  { key: 'openRequests', label: 'Open assistance requests' },
];

function StatTile({ label, value, help }) {
  return (
    <div className="rounded-xl border border-line bg-white p-5">
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
        <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {TILES.map((tile) => (
            <StatTile key={tile.key} label={tile.label} value={summary[tile.key]} help={tile.help} />
          ))}
        </dl>
      </section>

      <section aria-labelledby="departments-heading" className="space-y-4">
        <h2 id="departments-heading" className="text-xl font-bold text-slate-900">
          Queue by department
        </h2>
        <div className="relative overflow-x-auto rounded-xl border border-line bg-white">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">
              Active queue tokens and open assistance requests for each department (demo data)
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
