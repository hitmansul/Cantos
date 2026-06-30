import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';

const WORLD_CUP_2026_KEY = 'world_cup_2026';

async function ensureImportLogTable() {
  await sql`CREATE TABLE IF NOT EXISTS world_cup_pmsr_import_log (id SERIAL PRIMARY KEY, competition_key TEXT NOT NULL DEFAULT 'world_cup_2026', pdf_url TEXT NOT NULL, pdf_key TEXT NOT NULL, status TEXT NOT NULL, http_status INTEGER, saved_values INTEGER DEFAULT 0, metrics_count INTEGER DEFAULT 0, dry_run BOOLEAN DEFAULT false, source TEXT, error_message TEXT, payload JSONB, imported_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`CREATE INDEX IF NOT EXISTS idx_world_cup_pmsr_log_key ON world_cup_pmsr_import_log (competition_key, pdf_key)`;
}

export async function GET() {
  try {
    await ensureImportLogTable();

    const matchSummary = await sql`
      SELECT
        COUNT(*)::int AS total_matches,
        COUNT(*) FILTER (WHERE status ILIKE '%fim%' OR status ILIKE '%finished%' OR status ILIKE '%final%' OR home_score IS NOT NULL OR away_score IS NOT NULL)::int AS matches_finished,
        COUNT(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM world_cup_match_statistics s
          WHERE s.match_id = world_cup_matches.id AND s.source_key = 'fifa'
        ))::int AS matches_with_fifa_stats,
        COUNT(*) FILTER (WHERE NOT EXISTS (
          SELECT 1 FROM world_cup_match_statistics s
          WHERE s.match_id = world_cup_matches.id AND s.source_key = 'fifa'
        ))::int AS matches_without_fifa_stats
      FROM world_cup_matches
      WHERE competition_key = ${WORLD_CUP_2026_KEY}
    `;

    const logSummary = await sql`
      SELECT
        COUNT(*)::int AS total_runs,
        COUNT(DISTINCT pdf_key)::int AS distinct_pdfs_seen,
        COUNT(DISTINCT pdf_key) FILTER (WHERE dry_run = false AND status = 'success' AND saved_values > 0)::int AS imported_pdfs,
        COUNT(DISTINCT pdf_key) FILTER (WHERE dry_run = false AND status = 'failed')::int AS failed_pdfs,
        COALESCE(SUM(saved_values) FILTER (WHERE dry_run = false AND status = 'success'), 0)::int AS total_saved_values,
        MAX(imported_at) FILTER (WHERE dry_run = false AND status = 'success') AS last_success_at,
        MAX(imported_at) AS last_run_at
      FROM world_cup_pmsr_import_log
      WHERE competition_key = ${WORLD_CUP_2026_KEY}
    `;

    const lastImported = await sql`
      SELECT pdf_key, pdf_url, saved_values, metrics_count, imported_at, source
      FROM world_cup_pmsr_import_log
      WHERE competition_key = ${WORLD_CUP_2026_KEY}
        AND dry_run = false
        AND status = 'success'
        AND saved_values > 0
      ORDER BY imported_at DESC
      LIMIT 1
    `;

    const missing = await sql`
      SELECT
        m.id,
        m.home_team_name,
        m.away_team_name,
        m.kickoff_at,
        m.status,
        COUNT(s.id)::int AS fifa_stats_count
      FROM world_cup_matches m
      LEFT JOIN world_cup_match_statistics s ON s.match_id = m.id AND s.source_key = 'fifa'
      WHERE m.competition_key = ${WORLD_CUP_2026_KEY}
      GROUP BY m.id, m.home_team_name, m.away_team_name, m.kickoff_at, m.status
      HAVING COUNT(s.id) = 0
      ORDER BY m.kickoff_at NULLS LAST, m.id
      LIMIT 30
    `;

    return NextResponse.json({
      success: true,
      competition: WORLD_CUP_2026_KEY,
      scope: 'Somente Copa do Mundo 2026.',
      matches: matchSummary[0] ?? {},
      imports: logSummary[0] ?? {},
      lastImported: lastImported[0] ?? null,
      missingFifaStatsSample: missing,
      endpoints: {
        incrementalSync: '/api/world-cup/fifa-sync-latest',
        fullSync: '/api/world-cup/fifa-pmsr-sync?dryRun=false&limit=all&onlyMissing=false',
        log: '/api/world-cup/fifa-pmsr-log',
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Erro ao consultar status FIFA.' }, { status: 500 });
  }
}
