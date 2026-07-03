import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AdminApprovalsContent } from "../AdminApprovalsContent";

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-gray-600">Loading submissions...</p>
      </div>
    </div>
  );
}

async function getSubmissions() {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/admin/submissions`, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) throw new Error("Failed to fetch");
    return response.json();
  } catch (error) {
    console.error("Error fetching submissions:", error);
    return { success: true, data: [] };
  }
}

export default async function AdminApprovalsPage() {
  // Server-side fetch: no useState, no useEffect (rule 2)
  const initialData = await getSubmissions();

  return (
    <Suspense fallback={<LoadingFallback />}>
      <AdminApprovalsContent initialData={initialData} />
    </Suspense>
  );
}
