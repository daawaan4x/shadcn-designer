import fs from "fs"
import path from "path"
import { BlockViewer } from "@/components/block-viewer"

export default async function Page() {
  const blocksDir = path.join(process.cwd(), "app/blocks")
  let blocks: string[] = []
  try {
    const entries = fs.readdirSync(blocksDir, { withFileTypes: true })
    blocks = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  } catch (error) {
    console.error("Error reading blocks directory:", error)
  }

  return (
    <div className="flex h-svh w-full flex-col">
      <BlockViewer blocks={blocks} />
    </div>
  )
}
