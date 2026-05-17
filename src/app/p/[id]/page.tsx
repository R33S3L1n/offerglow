import { notFound } from "next/navigation";

interface PageParams {
  params: { id: string };
}

export default function PublishedPage({ params }: PageParams) {
  // Placeholder — requires database to fetch published pages.
  // Original local file-based publishing relied on filesystem;
  // this will be wired to Supabase.
  notFound();
}
