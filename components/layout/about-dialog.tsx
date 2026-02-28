"use client";

import { useTranslations } from "next-intl";
import { Github } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const REPO_URL = "https://github.com/williamhzo/quartier";
const GITHUB_URL = "https://github.com/williamhzo";
const TWITTER_URL = "https://x.com/williamhzo";

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function AboutDialog({ children }: { children: React.ReactNode }) {
  const t = useTranslations("about");

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("tagline")}</DialogDescription>
        </DialogHeader>

        <div className="text-muted-foreground space-y-3 text-sm">
          <p>{t("body")}</p>
          <p>
            {t("openSource")}{" "}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4"
            >
              GitHub
            </a>
            .
          </p>
        </div>

        <div className="border-border flex items-center gap-3 border-t pt-3">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="GitHub"
          >
            <Github className="size-4" />
          </a>
          <a
            href={TWITTER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="X (Twitter)"
          >
            <XIcon className="size-4" />
          </a>
          <span className="text-muted-foreground text-xs">@williamhzo</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
