import { Suspense } from "react";
import { getUserContentSubmissions } from "@/app/actions/dashboard/content";
import { ContentListContent } from "./ContentListContent";
import { Loader2 } from "lucide-react";

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-600">Loading your submissions...</p>
      </div>
    </div>
  );
}

export default async function ContentPage() {
  // Server-side fetch: no useState, no useEffect (rule 2)
  const initialData = await getUserContentSubmissions({
    page: 1,
    limit: 10,
  });

  return (
    <Suspense fallback={<LoadingFallback />}>
      <ContentListContent initialData={initialData} />
    </Suspense>
  );
}
