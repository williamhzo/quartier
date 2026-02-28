import { arrondissementSuffix } from "@/lib/arrondissements";

type Props = {
  number: number;
  locale: string;
  className?: string;
};

export function ArrondissementLabel({ number: n, locale, className }: Props) {
  if (locale === "fr") {
    const suffix = arrondissementSuffix(n, "fr");
    return (
      <span className={className}>
        {n}
        <sup className="text-[0.6em] align-super">{suffix}</sup>
      </span>
    );
  }

  const suffix = arrondissementSuffix(n, "en");
  return (
    <span className={className}>
      {n}
      {suffix} ARR.
    </span>
  );
}
