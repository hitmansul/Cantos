import { NextRequest, NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';
import { isAdmin } from '@/app/api/utils/adminAuth';

export async function GET(request: NextRequest) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const stats = await sql`
    SELECT ts.*, t.name as team_name FROM team_stats ts
    LEFT JOIN teams t ON ts.team_id = t.id
    ORDER BY ts.season DESC, t.name
  `;
  return NextResponse.json(stats);
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin(request)))
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const {
    id,
    team_id,
    season,
    games_played,
    avg_corners,
    home_avg,
    away_avg,
    over_85_pct,
    over_95_pct,
    over_105_pct,
    over_115_pct,
    home_games,
    away_games,
    games_winning,
    games_drawing,
    games_losing,
    corners_when_winning,
    corners_when_drawing,
    corners_when_losing,
    last_5_avg,
    recent_matches,
  } = body;

  if (id) {
    const setClauses = [
      `team_id = $1`,
      `season = $2`,
      `games_played = $3`,
      `avg_corners = $4`,
      `home_avg = $5`,
      `away_avg = $6`,
      `over_85_pct = $7`,
      `over_95_pct = $8`,
      `over_105_pct = $9`,
      `over_115_pct = $10`,
      `home_games = $11`,
      `away_games = $12`,
      `games_winning = $13`,
      `games_drawing = $14`,
      `games_losing = $15`,
      `corners_when_winning = $16`,
      `corners_when_drawing = $17`,
      `corners_when_losing = $18`,
      `last_5_avg = $19`,
      `recent_matches = $20`,
      `updated_at = CURRENT_TIMESTAMP`,
    ];
    await sql(`UPDATE team_stats SET ${setClauses.join(', ')} WHERE id = $21`, [
      team_id,
      season,
      games_played,
      avg_corners,
      home_avg,
      away_avg,
      over_85_pct,
      over_95_pct,
      over_105_pct,
      over_115_pct,
      home_games,
      away_games,
      games_winning,
      games_drawing,
      games_losing,
      corners_when_winning,
      corners_when_drawing,
      corners_when_losing,
      last_5_avg,
      recent_matches,
      id,
    ]);
  } else {
    await sql(
      `INSERT INTO team_stats (team_id, season, games_played, avg_corners, home_avg, away_avg,
        over_85_pct, over_95_pct, over_105_pct, over_115_pct, home_games, away_games,
        games_winning, games_drawing, games_losing, corners_when_winning, corners_when_drawing,
        corners_when_losing, last_5_avg, recent_matches)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
      [
        team_id,
        season,
        games_played,
        avg_corners,
        home_avg,
        away_avg,
        over_85_pct,
        over_95_pct,
        over_105_pct,
        over_115_pct,
        home_games,
        away_games,
        games_winning,
        games_drawing,
        games_losing,
        corners_when_winning,
        corners_when_drawing,
        corners_when_losing,
        last_5_avg,
        recent_matches,
      ]
    );
  }

  return NextResponse.json({ success: true });
}
