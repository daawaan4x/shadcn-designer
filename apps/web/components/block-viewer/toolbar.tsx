"use client"

import * as React from "react"
import { Monitor, Smartphone, Tablet, Moon, Sun, Laptop } from "lucide-react"
import { useTheme } from "next-themes"
import { ToggleGroup, ToggleGroupItem } from "@workspace/ui/components/toggle-group"

interface BlockViewerToolbarProps {
  selectedBlock: string
  screenSize: "desktop" | "tablet" | "phone"
  onScreenSizeChange: (size: "desktop" | "tablet" | "phone") => void
}

/**
 * Top header toolbar for the block viewer.
 *
 * Provides controls for selecting the preview device size and toggling the theme.
 */
export function BlockViewerToolbar({
  selectedBlock,
  screenSize,
  onScreenSizeChange,
}: BlockViewerToolbarProps) {
  const { theme, setTheme } = useTheme()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background px-4">
      <h1 className="text-sm font-medium">Viewing: {selectedBlock || "None"}</h1>
      <div className="flex items-center gap-4">
        {/* Device size selection */}
        <ToggleGroup 
          value={[screenSize]} 
          onValueChange={(val) => val.length > 0 && onScreenSizeChange(val[0] as any)}
        >
          <ToggleGroupItem value="desktop" aria-label="Desktop">
            <Monitor className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="tablet" aria-label="Tablet">
            <Tablet className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="phone" aria-label="Phone">
            <Smartphone className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>

        {/* Theme selection */}
        <ToggleGroup 
          value={theme ? [theme] : []} 
          onValueChange={(val) => val[0] && setTheme(val[0])}
        >
          <ToggleGroupItem value="light" aria-label="Light theme">
            <Sun className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="dark" aria-label="Dark theme">
            <Moon className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="system" aria-label="System theme">
            <Laptop className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
    </header>
  )
}
