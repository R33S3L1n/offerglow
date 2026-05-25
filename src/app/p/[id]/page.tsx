import { notFound } from "next/navigation";
import { getPublishedPage, incrementVisits } from "@/lib/kv";

interface PageParams {
  params: { id: string };
}

export default async function PublishedPage({ params }: PageParams) {
  const record = await getPublishedPage(params.id);
  if (!record) notFound();

  // Fire-and-forget: increment visit count (no await to keep response fast)
  incrementVisits(params.id).catch(() => {});

  // Return the clean HTML directly as a complete page
  return (
    <div
      dangerouslySetInnerHTML={{
        __html: record.html
          .replace("<!DOCTYPE html>", "")
          .replace(/<html[^>]*>/, "")
          .replace(/<\/html>/, "")
          .replace(/<head>[\s\S]*?<\/head>/, "")
          .replace(/<body[^>]*>/, "")
          .replace(/<\/body>/, ""),
      }}
    />
  );
}

// Override root layout — published pages should be standalone
export const metadata = {
  title: "OfferGlow - 个人网页分身",
};
