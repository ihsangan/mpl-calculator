import { useCallback, useRef, useState } from "react"
import html2canvas from "html2canvas-pro"

export interface SaveAsImageOptions {
  /** Custom export width in pixels (e.g. 520, 560, 600). Defaults to compact auto-fit (~540px). */
  width?: number
  /** Resolution scale multiplier (default: 2 for high-DPI output) */
  scale?: number
}

export function useSaveAsImage(
  filename: string,
  options?: SaveAsImageOptions
) {
  const ref = useRef<HTMLDivElement>(null)
  const [isExporting, setIsExporting] = useState(false)

  const save = useCallback(async () => {
    const el = ref.current
    if (!el || isExporting) return

    setIsExporting(true)

    // Measure table and content width
    const tableEl = el.querySelector("table")
    const tableScrollWidth = tableEl ? tableEl.scrollWidth : 0

    // Compact target width: user custom width, or tightly measured fit (default ~540px)
    const targetWidth = options?.width ?? Math.max(tableScrollWidth + 32, 540)
    const targetScale = options?.scale ?? 2
    const isDark = document.documentElement.classList.contains("dark")

    try {
      const canvas = await html2canvas(el, {
        backgroundColor: isDark ? "#18181b" : "#ffffff",
        scale: targetScale,
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: targetWidth + 40,
        width: targetWidth,
        onclone: (_clonedDoc, clonedEl) => {
          // A. Hide elements marked with data-capture-hide (buttons, iteration inputs)
          const hideNodes = clonedEl.querySelectorAll("[data-capture-hide]")
          hideNodes.forEach((node) => {
            ;(node as HTMLElement).style.display = "none"
          })

          // B. Expand all scrollable containers so nothing is cropped
          const overflowNodes = clonedEl.querySelectorAll(
            ".overflow-x-auto, [class*='overflow-x'], [class*='overflow-y']"
          )
          overflowNodes.forEach((node) => {
            const hNode = node as HTMLElement
            hNode.style.overflow = "visible"
            hNode.style.overflowX = "visible"
            hNode.style.overflowY = "visible"
            hNode.style.maxHeight = "none"
            hNode.style.maxWidth = "none"
            hNode.style.width = "100%"
          })

          // C. Set cloned element to precise target width
          clonedEl.style.width = `${targetWidth}px`
          clonedEl.style.minWidth = `${targetWidth}px`
          clonedEl.style.maxWidth = `${targetWidth}px`
          clonedEl.style.overflow = "visible"
          clonedEl.style.boxSizing = "border-box"
          clonedEl.style.margin = "0"

          // D. Make table full width within the card
          const clonedTable = clonedEl.querySelector("table")
          if (clonedTable) {
            clonedTable.style.width = "100%"
            clonedTable.style.minWidth = "100%"
            clonedTable.style.maxWidth = "100%"
          }
        },
      })

      const link = document.createElement("a")
      link.download = `${filename}-${Date.now()}.png`
      link.href = canvas.toDataURL("image/png")
      link.click()
    } catch (err) {
      console.error("Failed to export image:", err)
    } finally {
      setIsExporting(false)
    }
  }, [filename, isExporting, options?.width, options?.scale])

  return { ref, save, isExporting }
}
