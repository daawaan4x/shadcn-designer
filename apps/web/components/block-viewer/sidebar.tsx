"use client"

import * as React from "react"
import { ExternalLink } from "lucide-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar"

interface BlockViewerSidebarProps {
  blocks: string[]
  selectedBlock: string
  onSelectBlock: (block: string) => void
}

/**
 * Navigation sidebar for the block viewer.
 *
 * Lists available code blocks and allows opening them in a separate tab.
 */
export function BlockViewerSidebar({ blocks, selectedBlock, onSelectBlock }: BlockViewerSidebarProps) {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Code Blocks</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {blocks.map((block) => (
                <SidebarMenuItem key={block}>
                  <SidebarMenuButton
                    isActive={selectedBlock === block}
                    onClick={() => onSelectBlock(block)}
                  >
                    <span>{block}</span>
                  </SidebarMenuButton>
                  <SidebarMenuAction
                    showOnHover
                    render={
                      <a
                        href={`/blocks/${block}`}
                        target="_blank"
                        rel="noreferrer"
                        title="Open block in new tab"
                      >
                        <ExternalLink />
                        <span className="sr-only">Open</span>
                      </a>
                    }
                  />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
