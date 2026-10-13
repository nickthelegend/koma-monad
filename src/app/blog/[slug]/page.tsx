import type { Metadata } from "next";
import { readFileSync } from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { renderMarkdown } from "@/lib/md";

/** KOMA's build notes (docs/articles/<slug>.md), rendered at build time. */
const ARTICLES: Record<string, string> = { kimi: "How KOMA uses Kimi", hunyuan: "How KOMA uses Tencent Hunyuan" };

export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(ARTICLES).map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return ARTICLES[slug] ? { title: ARTICLES[slug], description: `${ARTICLES[slug]}: build notes from KOMA, a fan-owned comic studio on Monad.` } : {};
}

export default async function Article({ params }: Props) {
  const { slug } = await params;
  if (!ARTICLES[slug]) notFound();
  const md = readFileSync(path.join(process.cwd(), "docs", "articles", `${slug}.md`), "utf8");
  return (
    <article
      data-article={slug}
      className="mx-auto max-w-[760px] px-4 pb-20 pt-8 md:px-8 md:pt-12 [&_a]:text-arb [&_a]:underline [&_code]:font-mono [&_code]:text-[0.92em] [&_code]:text-bam [&_em]:text-soft [&_h1]:masthead [&_h1]:text-[clamp(40px,7vw,68px)] [&_h1]:text-kapow [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-[28px] [&_h2]:uppercase [&_h2]:text-paper [&_h3]:mt-7 [&_h3]:font-display [&_h3]:text-[21px] [&_h3]:uppercase [&_h3]:text-paper [&_li]:mt-1.5 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mt-4 [&_p]:text-[16.5px] [&_p]:leading-relaxed [&_p]:text-soft [&_pre]:mt-4 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-rule [&_pre]:bg-stock [&_pre]:p-4 [&_pre]:text-[13px] [&_pre_code]:text-soft [&_strong]:text-paper [&_table]:mt-4 [&_table]:w-full [&_table]:text-[14px] [&_td]:border-t [&_td]:border-rule [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_td]:text-soft [&_th]:py-2 [&_th]:pr-3 [&_th]:text-left [&_th]:text-mute [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:text-[16px] [&_ul]:text-soft"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(md) }}
    />
  );
}
