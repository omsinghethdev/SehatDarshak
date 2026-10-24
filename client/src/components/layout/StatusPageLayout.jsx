import { Container } from '../common/Container';

/** Centered single-message page used for sign-in placeholders and error routes. */
export function StatusPageLayout({ icon: Icon, eyebrow, title, children, actions }) {
  return (
    <Container className="flex justify-center py-16 sm:py-24">
      <div className="w-full max-w-lg rounded-xl border border-line bg-white p-5 shadow-raised sm:p-10">
        {Icon && (
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-50">
            <Icon aria-hidden="true" className="size-6 text-brand-700" />
          </span>
        )}
        {eyebrow && <p className="mt-5 text-sm font-semibold text-brand-700">{eyebrow}</p>}
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        <div className="mt-4 space-y-4 text-slate-700">{children}</div>
        {actions && <div className="mt-8 flex flex-col gap-3 sm:flex-row">{actions}</div>}
      </div>
    </Container>
  );
}
