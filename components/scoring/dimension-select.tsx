"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DimensionKey } from "@/lib/types";
import { DIMENSION_KEYS } from "@/lib/arrondissements";

type Props = {
  value: DimensionKey | "composite";
  onChange: (value: DimensionKey | "composite") => void;
};

export function DimensionSelect({ value, onChange }: Props) {
  const t = useTranslations("dimensions");

  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as DimensionKey | "composite")}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="composite">{t("composite")}</SelectItem>
        {DIMENSION_KEYS.map((key) => (
          <SelectItem key={key} value={key}>
            {t(key)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
