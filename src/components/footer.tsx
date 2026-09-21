import React from "react"
import { GithubLight as GithubIcon } from "@/components/ui/svgs/githubLight"

export const Footer: React.FC = () => {
  return (
    <footer className="flex flex-col items-center justify-between gap-3 border-t pt-6 pb-8 text-xs text-muted-foreground sm:flex-row">
      <p>
        Data provided by{" "}
        <a
          href="https://liquipedia.net/commons/Liquipedia:Copyrights"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          Liquipedia
        </a>{" "}
        under{" "}
        <a
          href="https://creativecommons.org/licenses/by-sa/3.0/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          CC BY-SA 3.0
        </a>
      </p>
      <a
        href="https://github.com/ihsangan/mpl-calculator"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <GithubIcon className="size-4" aria-hidden="true" />
        <span>GitHub</span>
      </a>
    </footer>
  )
}
