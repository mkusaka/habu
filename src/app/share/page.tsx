import { ShareForm } from "./share-form";

interface SharePageProps {
  searchParams: Promise<{ url?: string; title?: string; text?: string }>;
}

export default async function SharePage({ searchParams }: SharePageProps) {
  const params = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <ShareForm
        initialUrl={params.url || ""}
        initialTitle={params.title || ""}
        initialComment={params.text || ""}
      />
    </div>
  );
}
