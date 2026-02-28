"use client";

import { useTranslations } from "next-intl";
import { Briefcase, Users, Camera, LaptopMinimal } from "lucide-react";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PersonaKey } from "@/lib/types";

const PERSONAS: { key: PersonaKey; icon: typeof Briefcase }[] = [
  { key: "tourist", icon: Camera },
  { key: "youngPro", icon: LaptopMinimal },
  { key: "family", icon: Users },
  { key: "business", icon: Briefcase },
];

type Props = {
  value: PersonaKey;
  onChange: (value: PersonaKey) => void;
};

export function PersonaSelector({ value, onChange }: Props) {
  const t = useTranslations("personas");

  return (
    <TooltipProvider delayDuration={300}>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => {
          if (v) onChange(v as PersonaKey);
        }}
        variant="outline"
        size="sm"
      >
        {PERSONAS.map(({ key, icon: Icon }) => (
          <Tooltip key={key}>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value={key}
                aria-label={t(key)}
                className="aria-checked:bg-foreground aria-checked:text-background"
              >
                <Icon className="size-4" />
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {t(key)}
            </TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
    </TooltipProvider>
  );
}
