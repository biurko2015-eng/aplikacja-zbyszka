-- ==========================================
-- COMPASS ASSIST - DATABASE SETUP
-- ==========================================
-- 1. Enable pgvector if not enabled
CREATE EXTENSION IF NOT EXISTS vector;
-- 2. Knowledge Base Table
CREATE TABLE IF NOT EXISTS compass_assist_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    -- 'umowy', 'benefity', 'finanse', 'hr', 'it', 'ogolne'
    metadata JSONB DEFAULT '{}'::jsonb,
    embedding vector(1536),
    -- OpenAI text-embedding-3-small
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- 3. Chat History Table
CREATE TABLE IF NOT EXISTS compass_assist_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    messages JSONB DEFAULT '[]'::jsonb,
    context JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- 4. Escalation Tickets Table
CREATE TABLE IF NOT EXISTS compass_assist_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    chat_id UUID REFERENCES compass_assist_chats(id) ON DELETE
    SET NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new' CHECK (
            status IN ('new', 'in_progress', 'resolved', 'closed')
        ),
        priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        summary TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- 5. RPC Function for Knowledge Matching (RAG)
CREATE OR REPLACE FUNCTION match_assist_knowledge (
        query_embedding vector(1536),
        match_threshold float,
        match_count int,
        filter_category text DEFAULT NULL
    ) RETURNS TABLE (
        id uuid,
        content text,
        category text,
        metadata jsonb,
        similarity float
    ) LANGUAGE plpgsql AS $$ BEGIN RETURN QUERY
SELECT k.id,
    k.content,
    k.category,
    k.metadata,
    1 - (k.embedding <=> query_embedding) AS similarity
FROM compass_assist_knowledge k
WHERE (
        1 - (k.embedding <=> query_embedding) > match_threshold
    )
    AND (
        filter_category IS NULL
        OR k.category = filter_category
    )
ORDER BY k.embedding <=> query_embedding
LIMIT match_count;
END;
$$;
-- 6. RLS Policies
ALTER TABLE compass_assist_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE compass_assist_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE compass_assist_tickets ENABLE ROW LEVEL SECURITY;
-- Knowledge: Admins can do everything, users can read
CREATE POLICY "Admins can manage knowledge" ON compass_assist_knowledge FOR ALL TO authenticated USING (
    (
        SELECT role
        FROM profiles
        WHERE id = auth.uid()
    ) = 'admin'
);
CREATE POLICY "Users can read knowledge" ON compass_assist_knowledge FOR
SELECT TO authenticated USING (true);
-- Chats: Users can view/manage own chats, admins can view all
CREATE POLICY "Users can manage own chats" ON compass_assist_chats FOR ALL TO authenticated USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Admins can view all chats" ON compass_assist_chats FOR
SELECT TO authenticated USING (
        (
            SELECT role
            FROM profiles
            WHERE id = auth.uid()
        ) = 'admin'
    );
-- Tickets: Users can view/manage own tickets, admins can manage all
CREATE POLICY "Users can manage own tickets" ON compass_assist_tickets FOR ALL TO authenticated USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Admins can manage all tickets" ON compass_assist_tickets FOR ALL TO authenticated USING (
    (
        SELECT role
        FROM profiles
        WHERE id = auth.uid()
    ) = 'admin'
);