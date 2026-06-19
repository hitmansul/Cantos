import crypto from 'node:crypto';
import sql from '@/app/api/utils/sql';
import { assertPersistentDatabaseConfigured } from './database';

export type AiKnowledgeDocument = {
  namespace: string;
  key: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
  sourceKey: string;
  sourceUpdatedAt?: string | null;
};

export async function upsertAiKnowledgeDocument(document: AiKnowledgeDocument): Promise<void> {
  assertPersistentDatabaseConfigured();
  await sql`
    INSERT INTO ai_knowledge_documents (
      namespace,
      knowledge_key,
      title,
      content,
      metadata,
      source_key,
      source_updated_at
    )
    VALUES (
      ${document.namespace},
      ${document.key},
      ${document.title},
      ${document.content},
      ${JSON.stringify(document.metadata ?? {})}::jsonb,
      ${document.sourceKey},
      ${document.sourceUpdatedAt ?? null}
    )
    ON CONFLICT (namespace, knowledge_key) DO UPDATE SET
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      metadata = EXCLUDED.metadata,
      source_key = EXCLUDED.source_key,
      source_updated_at = EXCLUDED.source_updated_at,
      updated_at = NOW()
  `;
}

export function hashQuestion(question: string): string {
  return crypto.createHash('sha256').update(question.trim().toLowerCase()).digest('hex');
}

export async function getCachedAiReply(question: string): Promise<string | null> {
  assertPersistentDatabaseConfigured();
  const rows = await sql`
    SELECT answer
    FROM ai_response_cache
    WHERE question_hash = ${hashQuestion(question)}
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
  `;
  return typeof rows[0]?.answer === 'string' ? rows[0].answer : null;
}

export async function cacheAiReply(
  question: string,
  answer: string,
  metadata: Record<string, unknown> = {},
  ttlMinutes = 60
): Promise<void> {
  assertPersistentDatabaseConfigured();
  await sql`
    INSERT INTO ai_response_cache (question_hash, question, answer, metadata, expires_at)
    VALUES (
      ${hashQuestion(question)},
      ${question},
      ${answer},
      ${JSON.stringify(metadata)}::jsonb,
      NOW() + (${ttlMinutes} || ' minutes')::interval
    )
    ON CONFLICT (question_hash) DO UPDATE SET
      question = EXCLUDED.question,
      answer = EXCLUDED.answer,
      metadata = EXCLUDED.metadata,
      expires_at = EXCLUDED.expires_at,
      created_at = NOW()
  `;
}
