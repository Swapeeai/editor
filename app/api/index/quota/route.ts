import { NextResponse } from "next/server"
import { estimateIndexUse, FREE_INDEX_MINUTES } from "@/lib/ai-index"
import { productionGate } from "@/lib/production-gate"

export const dynamic = "force-dynamic"

export async function GET() {
  const denied = await productionGate()
  if (denied) return denied
  const quota = await estimateIndexUse()
  const usedMinutes = Math.round((quota.usedSeconds / 60) * 10) / 10
  const remainingMinutes = Math.max(0, Math.round(((quota.limitSeconds - quota.usedSeconds) / 60) * 10) / 10)
  return NextResponse.json({
    ok: quota.ok,
    usedMinutes,
    remainingMinutes,
    limitMinutes: FREE_INDEX_MINUTES,
    estimate: true,
    usageReady: quota.usageReady,
    message: quota.message,
  })
}
