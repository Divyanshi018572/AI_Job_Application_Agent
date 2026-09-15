"use client"

import * as React from "react"
import {
  Briefcase,
  ExternalLink,
  Loader2,
  MapPin,
  Plus,
  Sparkles,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface JobRow {
  id: string
  platform: string
  title: string
  company: string
  location: string | null
  experience_level: string | null
  employment_type: string | null
  work_mode: string | null
  job_url: string
  fetched_at: string
  classified_at: string | null
}

interface BoardRef {
  platform: string
  boardToken: string
  companyDisplayName?: string
}

interface IngestResponse {
  status: "cached" | "fetched"
  jobsFetched: number
  jobsUpserted: number
  jobsClassified: number
  pendingClassification: number
  classificationFailures: number
  classificationError?: string
  error?: string
}

const PLATFORMS = [
  { value: "greenhouse", label: "Greenhouse" },
  { value: "lever", label: "Lever" },
  { value: "workable", label: "Workable" },
] as const

export function JobsListView() {
  const [jobs, setJobs] = React.useState<JobRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [platform, setPlatform] = React.useState<string>("greenhouse")
  const [boardToken, setBoardToken] = React.useState("")
  const [companyDisplayName, setCompanyDisplayName] = React.useState("")
  const [ingesting, setIngesting] = React.useState(false)
  const [statusMessage, setStatusMessage] = React.useState("")
  const [warningMessage, setWarningMessage] = React.useState("")
  const [errorMessage, setErrorMessage] = React.useState("")
  /** Board last fetched this session, and how many of its jobs still need
   * tags — drives the "Tag more" button. */
  const [lastBoard, setLastBoard] = React.useState<BoardRef | null>(null)
  const [pendingCount, setPendingCount] = React.useState(0)

  const fetchJobs = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/jobs")
      if (!res.ok) throw new Error("Failed to fetch jobs")
      const data = await res.json()
      setJobs(data.jobs || [])
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error loading jobs")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  /** Fetches the board (unless fetched in the last 6 hours) and tags the
   * next batch of its untagged jobs. Calling it again for the same board is
   * how "Tag more" works. */
  async function runIngest(board: BoardRef, isTagMore: boolean): Promise<boolean> {
    setIngesting(true)
    setErrorMessage("")
    setWarningMessage("")
    setStatusMessage(
      isTagMore
        ? "Tagging the next batch of jobs..."
        : "Fetching jobs and tagging the first batch — this can take up to a minute..."
    )

    try {
      const res = await fetch("/api/jobs/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(board),
      })

      const data = (await res.json()) as IngestResponse
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch jobs for that company")
      }

      const saved =
        data.status === "fetched"
          ? `Saved ${data.jobsUpserted} job${data.jobsUpserted === 1 ? "" : "s"}. `
          : ""
      const tagged = `Tagged ${data.jobsClassified}${
        data.pendingClassification > 0 ? `, ${data.pendingClassification} still untagged` : ""
      }.`
      setStatusMessage(saved + tagged)
      setTimeout(() => setStatusMessage(""), 6000)

      // Not auto-dismissed: repeated classification failures usually mean a
      // config problem (bad key, retired model) the user needs to act on.
      setWarningMessage(
        data.classificationFailures > 0
          ? `${data.classificationFailures} job${data.classificationFailures === 1 ? "" : "s"} couldn't be tagged this time and will be retried on "Tag more". Reason: ${data.classificationError ?? "unknown error"}`
          : ""
      )

      setLastBoard(board)
      setPendingCount(data.pendingClassification)
      await fetchJobs()
      return true
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to fetch jobs")
      return false
    } finally {
      setIngesting(false)
    }
  }

  async function handleAddCompany(e: React.FormEvent) {
    e.preventDefault()
    if (!boardToken.trim()) return

    const ok = await runIngest(
      {
        platform,
        boardToken: boardToken.trim(),
        companyDisplayName: companyDisplayName.trim() || undefined,
      },
      false
    )
    if (ok) {
      setBoardToken("")
      setCompanyDisplayName("")
    }
  }

  return (
    <div className="space-y-8 pb-16">
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <Plus className="h-5 w-5 text-indigo-600" /> Track a Company
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-xs text-slate-500">
            Enter a company&apos;s ATS board token (the part of their careers
            URL after the platform domain — e.g. for{" "}
            <code className="rounded bg-slate-100 px-1">
              boards.greenhouse.io/acme
            </code>
            , the token is <code className="rounded bg-slate-100 px-1">acme</code>).
          </p>
          <form
            onSubmit={handleAddCompany}
            className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr_1fr_auto]"
          >
            <Select
              value={platform}
              onValueChange={(value) => {
                if (value) setPlatform(value)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                {PLATFORMS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Board token (e.g. acme)"
              value={boardToken}
              onChange={(e) => setBoardToken(e.target.value)}
              disabled={ingesting}
            />
            <Input
              placeholder="Display name (optional)"
              value={companyDisplayName}
              onChange={(e) => setCompanyDisplayName(e.target.value)}
              disabled={ingesting}
            />
            <Button type="submit" disabled={ingesting || !boardToken.trim()}>
              {ingesting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Fetch Jobs
            </Button>
          </form>

          {statusMessage && (
            <p className="mt-3 text-sm font-medium text-emerald-600">
              {statusMessage}
            </p>
          )}
          {warningMessage && (
            <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
              {warningMessage}
            </p>
          )}
          {errorMessage && (
            <p className="mt-3 text-sm font-medium text-red-600">{errorMessage}</p>
          )}
          {lastBoard && pendingCount > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
              <p className="text-sm text-indigo-900">
                {pendingCount} job{pendingCount === 1 ? "" : "s"} from{" "}
                <span className="font-semibold">
                  {lastBoard.companyDisplayName || lastBoard.boardToken}
                </span>{" "}
                still need experience / type / work-mode tags.
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={ingesting}
                onClick={() => runIngest(lastBoard, true)}
              >
                {ingesting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                Tag more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h3 className="text-base font-semibold text-slate-900 dark:text-white">
          Jobs ({jobs.length})
        </h3>

        {loading ? (
          <div className="flex min-h-[160px] items-center justify-center">
            <Loader2 className="size-8 animate-spin text-indigo-500" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
              <Briefcase className="size-7" />
            </div>
            <p className="text-base font-medium text-slate-800">
              No jobs tracked yet
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Add a company above to fetch and classify its open roles.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md md:flex-row md:items-center"
              >
                <div className="flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
                    <Briefcase className="size-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{job.title}</p>
                    <p className="text-sm text-slate-600">{job.company}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="capitalize">
                        {job.platform}
                      </Badge>
                      {job.location && (
                        <Badge variant="outline" className="gap-1">
                          <MapPin className="size-3" />
                          {job.location}
                        </Badge>
                      )}
                      {job.work_mode && (
                        <Badge variant="outline">{job.work_mode}</Badge>
                      )}
                      {job.employment_type && (
                        <Badge variant="outline">{job.employment_type}</Badge>
                      )}
                      {job.experience_level && (
                        <Badge variant="outline" className="gap-1">
                          <Sparkles className="size-3" />
                          {job.experience_level}
                        </Badge>
                      )}
                      {!job.classified_at && (
                        <Badge variant="outline" className="border-dashed text-slate-400">
                          Not tagged yet
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <a
                  href={job.job_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                >
                  <Button variant="outline" size="sm">
                    View <ExternalLink className="ml-1.5 size-3.5" />
                  </Button>
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
