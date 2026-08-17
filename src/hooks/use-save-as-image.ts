import { useCallback, useRef, useState } from "react"
import html2canvas from "html2canvas-pro"

/**
 * Pre-converts all <img> elements inside a container to Base64 data URLs.
 * Returns a cleanup function that restores original src values.
 */
async function convertImagesToBase64(el: HTMLElement): Promise<() => void> {
  const images = Array.from(el.querySelectorAll<HTMLImageElement>("img"))
  const originalSrcMap = new Map<HTMLImageElement, string>()

  await Promise.all(
    images.map(async (img) => {
      const src = img.currentSrc || img.src
      if (!src || src.startsWith("data:")) return

      originalSrcMap.set(img, src)

      try {
        const res = await fetch(src, { mode: "cors" })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const blob = await res.blob()
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
        img.src = dataUrl
      } catch {
        // Fallback: draw through an offscreen Image element
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const tempImg = new Image()
            tempImg.crossOrigin = "anonymous"
            tempImg.onload = () => {
              try {
                const canvas = document.createElement("canvas")
                canvas.width = tempImg.naturalWidth || 60
                canvas.height = tempImg.naturalHeight || 60
                const ctx = canvas.getContext("2d")
                if (ctx) {
                  ctx.drawImage(tempImg, 0, 0)
                  resolve(canvas.toDataURL("image/png"))
                } else {
                  reject(new Error("No 2d context"))
                }
              } catch (e) {
                reject(e)
              }
            }
            tempImg.onerror = reject
            tempImg.src = src
          })
          img.src = dataUrl
        } catch {
          // Keep original src if both methods fail
        }
      }
    })
  )

  return () => {
    originalSrcMap.forEach((origSrc, img) => {
      img.src = origSrc
    })
  }
}

export function useSaveAsImage(filename: string) {
  const ref = useRef<HTMLDivElement>(null)
  const [isExporting, setIsExporting] = useState(false)

  const save = useCallback(async () => {
    const el = ref.current
    if (!el || isExporting) return

    setIsExporting(true)

    // 1. Convert all team logos to base64 data URLs
    const restoreImages = await convertImagesToBase64(el)

    // 2. Measure content dimensions to ensure full table capture
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
      restoreImages()
      setIsExporting(false)
    }
  }, [filename, isExporting])

  return { ref, save, isExporting }
}
