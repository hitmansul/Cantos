import { NextResponse } from 'next/server';
import sql from '@/app/api/utils/sql';

export async function GET() {
  try {
    const faqs = await sql`
      SELECT question, asked_count
      FROM faq_questions
      ORDER BY asked_count DESC
      LIMIT 6
    `;
    return NextResponse.json({ faqs });
  } catch (error) {
    console.error('FAQ fetch error:', error);
    return NextResponse.json({ faqs: [] });
  }
}
