"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PersonaKey } from "@/lib/types";

const PERSONA_KEYS: PersonaKey[] = [
  "youngPro",
  "family",
  "tourist",
  "business",
];

type Props = {
  value: PersonaKey;
  onChange: (value: PersonaKey) => void;
};

export function PersonaSelector({ value, onChange }: Props) {
  const t = useTranslations("personas");

  return (
    <Select value={value} onValueChange={(v) => onChange(v as PersonaKey)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PERSONA_KEYS.map((key) => (
          <SelectItem key={key} value={key}>
            {t(key)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
