"use client"

import * as React from "react"
import { SidebarProvider, SidebarInset } from "@workspace/ui/components/sidebar"
import { BlockViewerSidebar } from "./sidebar"
import { BlockViewerToolbar } from "./toolbar"
import { BlockViewerPreview } from "./preview"

/**
 * Main block viewer application boundary.
 *
 * Coordinates the sidebar, toolbar, and preview panes for viewing design blocks.
 */
export function BlockViewer({ blocks }: { blocks: string[] }) {
  const [selectedBlock, setSelectedBlock] = React.useState(blocks[0] || "")
  const [screenSize, setScreenSize] = React.useState<"desktop" | "tablet" | "phone">("desktop")

  return (
    <SidebarProvider>
      <BlockViewerSidebar 
        blocks={blocks} 
        selectedBlock={selectedBlock} 
        onSelectBlock={setSelectedBlock} 
      />
      <SidebarInset className="flex flex-col">
        <BlockViewerToolbar 
          selectedBlock={selectedBlock} 
          screenSize={screenSize} 
          onScreenSizeChange={setScreenSize} 
        />
        <BlockViewerPreview 
          selectedBlock={selectedBlock} 
          screenSize={screenSize} 
        />
      </SidebarInset>
    </SidebarProvider>
  )
}
