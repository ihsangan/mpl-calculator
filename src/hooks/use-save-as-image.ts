import { useCallback, useRef, useState } from "react"
import html2canvas from "html2canvas-pro"

export function useSaveAsImage(filename: string) {
  const ref = useRef<HTMLDivElement>(null)
  const [isExporting, setIsExporting] = useState(false)

  const save = useCallback(async () => {
    const el = ref.current
    if (!el || isExporting) return

    setIsExporting(true)

    // Measure content dimensions to ensure full table capture
    const tableEl = el.querySelector("table")
    const tableWidth = tableEl ? tableEl.scrollWidth : 0
    const contentWidth = Math.max(el.scrollWidth, tableWidth, 720)
    const isDark = document.documentElement.classList.contains("dark")

    try {
      const canvas = await html2canvas(el, {
        backgroundColor: isDark ? "#18181b" : "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: contentWidth + 100,
        width: contentWidth,
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

          // C. Set cloned element to full width
          clonedEl.style.width = `${contentWidth}px`
          clonedEl.style.minWidth = `${contentWidth}px`
          clonedEl.style.maxWidth = "none"
          clonedEl.style.overflow = "visible"
          clonedEl.style.boxSizing = "border-box"

          // D. Make table full width with ample column space
          const clonedTable = clonedEl.querySelector("table")
          if (clonedTable) {
            clonedTable.style.width = "100%"
            clonedTable.style.minWidth = "100%"
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
  }, [filename, isExporting])

  return { ref, save, isExporting }
}
