export function CardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-20 bg-gray-200 rounded-lg"></div>
    </div>
  );
}

export function TableRowSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-10 bg-gray-200 rounded-lg"></div>
      <div className="h-10 bg-gray-200 rounded-lg"></div>
      <div className="h-10 bg-gray-200 rounded-lg"></div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 bg-gray-200 rounded w-1/3"></div>
      <div className="flex space-x-2 h-32">
        <div className="flex-1 bg-gray-200 rounded-lg"></div>
        <div className="flex-1 bg-gray-200 rounded-lg"></div>
        <div className="flex-1 bg-gray-200 rounded-lg"></div>
        <div className="flex-1 bg-gray-200 rounded-lg"></div>
      </div>
    </div>
  );
}
