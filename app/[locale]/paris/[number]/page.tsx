import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ locale: string; number: string }>;
};

const VALID_NUMBERS = Array.from({ length: 20 }, (_, i) => String(i + 1));

export function generateStaticParams() {
  return VALID_NUMBERS.map((number) => ({ number }));
}

export default async function DetailPage({ params }: Props) {
  const { locale, number } = await params;
  if (!VALID_NUMBERS.includes(number)) {
    notFound();
  }
  setRequestLocale(locale);

  return <DetailPageContent number={Number(number)} />;
}

function DetailPageContent({ number }: { number: number }) {
  const t = useTranslations("detail");
  const suffix = number === 1 ? "er" : "e";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-semibold">
        {number}
        <sup>{suffix}</sup> arrondissement
      </h1>
      <p className="text-muted-foreground mt-1">{t("scores")}</p>
    </div>
  );
}
