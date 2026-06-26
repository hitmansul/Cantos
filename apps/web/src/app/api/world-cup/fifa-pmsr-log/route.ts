import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export const dynamic = 'force-dynamic';

const WORLD_CUP_2026_KEY = 'world_cup_2026';

export async function GET() {
  try {
    const summary = await sql`
      SELECT
        COUNT(*)::int AS total_runs,
        COUNT(DISTINCT pdf_key)::int AS distinct_pdfs_seen,
        COUNT(DISTINCT pdf_key) FILTER (WHERE dry_run = false AND status = 'success' AND saved_values > 0)::int AS imported_pdfs,
        COUNT(DISTINCT pdf_key) FILTER (WHERE dry_run = false AND status = 'failed')::int AS failed_pdfs,
        COALESCE(SUM(saved_values) FILTER (WHERE dry_run = false AND status = 'success'), 0)::int AS total_saved_values,
        MAX(imported_at) AS last_import_at
      FROM world_cup_pmsr_import_log
      WHERE competition_key = ${WORLD_CUP_2026_KEY}
    `;

    const recent = await sql`
      SELECT DISTINCT ON (pdf_key)
        pdf_key,
        pdf_url,
        status,
        http_status,
        saved_values,
        metrics_count,
        dry_run,
        source,
        error_message,
        imported_at
      FROM world_cup_pmsr_import_log
      WHERE competition_key = ${WORLD_CUP_2026_KEY}
      ORDER BY pdf_key, imported_at DESC
      LIMIT 120
    `;

    return NextResponse.json({
      success: true,
      competition: WORLD_CUP_2026_KEY,
      scope: 'Somente Copa do Mundo 2026.',
      summary: summary[0] ?? {},
      failed: recent.filter((row: any) => row.status === 'failed'),
      recent,
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao consultar log PMSR.',
      hint: 'Rode primeiro /api/world-cup/fifa-pmsr-sync?dryRun=true&limit=1 para o sincronizador preparar o log.',
    }, { status: 500 });
  }
}
