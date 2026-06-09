"use client"

import * as React from "react"

interface BlockViewerPreviewProps {
  selectedBlock: string
  screenSize: "desktop" | "tablet" | "phone"
}

/**
 * Resizable iframe preview for the selected block.
 *
 * Handles mouse drag events to resize the viewport width for testing responsiveness.
 */
export function BlockViewerPreview({ selectedBlock, screenSize }: BlockViewerPreviewProps) {
  const [customWidth, setCustomWidth] = React.useState<number | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  // Reset any custom drag width if the user switches the base screen size constraint.
  React.useEffect(() => {
    setCustomWidth(null)
  }, [screenSize])

  /**
   * Initializes the mouse drag interaction for the preview boundary.
   * 
   * Calculates boundaries based on the parent container padding to prevent dragging 
   * beyond the visible layout.
   */
  const startDrag = (e: React.MouseEvent, direction: "left" | "right") => {
    e.preventDefault()
    setIsDragging(true)
    const startX = e.clientX
    const startWidth = containerRef.current?.getBoundingClientRect().width || 0
    
    let maxAllowedWidth = window.innerWidth
    if (containerRef.current?.parentElement) {
      const parent = containerRef.current.parentElement
      const parentStyles = window.getComputedStyle(parent)
      const paddingX = parseFloat(parentStyles.paddingLeft) + parseFloat(parentStyles.paddingRight)
      maxAllowedWidth = parent.clientWidth - paddingX
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      // If dragging the right handle, moving right (positive delta) increases width.
      // If dragging the left handle, moving left (negative delta) increases width.
      const effectiveDelta = direction === "right" ? deltaX : -deltaX
      // Multiply by 2 because the preview is centered; expanding one side expands both visually.
      const newWidth = startWidth + effectiveDelta * 2
      setCustomWidth(Math.min(maxAllowedWidth, Math.max(320, newWidth)))
    }

    const onMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  const widthClass = {
    desktop: "w-full",
    tablet: "w-[768px]",
    phone: "w-[375px]"
  }[screenSize]

  if (!selectedBlock) {
    return (
      <div className="flex flex-1 items-center justify-center bg-muted/50 p-4 md:p-8">
        <p className="text-sm text-muted-foreground">Select a block from the sidebar</p>
      </div>
    )
  }

  return (
    <div className="min-w-0 flex-1 overflow-hidden bg-muted/50 p-4 md:p-8 flex items-start justify-center">
      <div
        ref={containerRef}
        className={`relative flex flex-col bg-background shadow-sm border rounded-xl overflow-hidden h-full ${customWidth === null ? widthClass : ''} ${!isDragging ? 'transition-all duration-300 ease-in-out' : ''}`}
        style={{ 
          width: customWidth !== null ? `${customWidth}px` : undefined,
          maxWidth: "100%", 
          minWidth: "320px" 
        }}
      >
        <iframe
          src={`/blocks/${selectedBlock}`}
          className={`flex-1 w-full border-0 ${isDragging ? 'pointer-events-none' : ''}`}
          title={`Preview of ${selectedBlock}`}
        />
        
        {/* Right Drag Handle */}
        <div 
          className="absolute inset-y-0 right-0 w-4 cursor-ew-resize hover:bg-primary/10 active:bg-primary/20 transition-colors z-10 flex items-center justify-center"
          onMouseDown={(e) => startDrag(e, "right")}
        >
          <div className="w-1 h-8 bg-border rounded-full" />
        </div>
        
        {/* Left Drag Handle */}
        <div 
          className="absolute inset-y-0 left-0 w-4 cursor-ew-resize hover:bg-primary/10 active:bg-primary/20 transition-colors z-10 flex items-center justify-center"
          onMouseDown={(e) => startDrag(e, "left")}
        >
          <div className="w-1 h-8 bg-border rounded-full" />
        </div>
      </div>
    </div>
  )
}
