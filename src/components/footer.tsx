import React from "react"

export const Footer: React.FC = () => {
  return (
    <footer className="border-t pt-6 pb-8 text-center text-xs text-muted-foreground">
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
    </footer>
  )
}
