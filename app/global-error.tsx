'use client';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body className="bg-background">
        <div className="flex flex-col items-center justify-center h-screen gap-4 text-center px-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold text-foreground">Application Error</h1>
            <p className="text-zinc-400">An unexpected error occurred. Please try again.</p>
          </div>
          <button
            onClick={reset}
            className="px-6 py-2 bg-[#00c97a] hover:bg-[#00b368] rounded-full text-white font-medium transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
