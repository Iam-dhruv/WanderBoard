export function TripFeaturePlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-400">Coming soon</p>
      <h2 className="mt-2 text-2xl font-semibold text-gray-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-gray-500">{description}</p>
    </div>
  );
}