import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const { secret } = await request.json()
        if (secret !== 'migrate-task-engine-2026') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const dbUrl = process.env.DATABASE_URL
        if (!dbUrl) {
            return NextResponse.json({ error: 'No DATABASE_URL' }, { status: 500 })
        }

        const { Client } = await import('pg')
        const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
        await client.connect()

        const statements = [
            `CREATE TABLE IF NOT EXISTS task_boards (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title TEXT NOT NULL, description TEXT,
                owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
                visibility TEXT DEFAULT 'team' CHECK (visibility IN ('private', 'team', 'public')),
                archived BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
            `CREATE TABLE IF NOT EXISTS task_columns (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                board_id UUID NOT NULL REFERENCES task_boards(id) ON DELETE CASCADE,
                title TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0,
                color TEXT DEFAULT '#3B82F6', wip_limit INTEGER,
                created_at TIMESTAMPTZ DEFAULT NOW())`,
            `CREATE TABLE IF NOT EXISTS tasks (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                board_id UUID NOT NULL REFERENCES task_boards(id) ON DELETE CASCADE,
                column_id UUID NOT NULL REFERENCES task_columns(id) ON DELETE CASCADE,
                title TEXT NOT NULL, description TEXT,
                priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
                status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'review', 'done', 'blocked')),
                position INTEGER NOT NULL DEFAULT 0, due_date DATE,
                labels TEXT[] DEFAULT '{}',
                created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
                updated_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW())`,
            `CREATE TABLE IF NOT EXISTS task_assignments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                assigned_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(task_id, user_id))`,
            `CREATE TABLE IF NOT EXISTS task_comments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
                content TEXT NOT NULL, parent_id UUID REFERENCES task_comments(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW())`,
            `CREATE TABLE IF NOT EXISTS task_activity (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
                action TEXT NOT NULL, details JSONB DEFAULT '{}',
                created_at TIMESTAMPTZ DEFAULT NOW())`,
            `CREATE INDEX IF NOT EXISTS idx_tasks_board_id ON tasks(board_id)`,
            `CREATE INDEX IF NOT EXISTS idx_tasks_column_id ON tasks(column_id)`,
            `CREATE INDEX IF NOT EXISTS idx_task_columns_board_id ON task_columns(board_id)`,
            `CREATE INDEX IF NOT EXISTS idx_task_assignments_task_id ON task_assignments(task_id)`,
            `CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id)`,
            `CREATE INDEX IF NOT EXISTS idx_task_activity_task_id ON task_activity(task_id)`,
            `ALTER TABLE task_boards ENABLE ROW LEVEL SECURITY`,
            `ALTER TABLE task_columns ENABLE ROW LEVEL SECURITY`,
            `ALTER TABLE tasks ENABLE ROW LEVEL SECURITY`,
            `ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY`,
            `ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY`,
            `ALTER TABLE task_activity ENABLE ROW LEVEL SECURITY`,
        ]

        const rls = [
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_boards' AND policyname='task_boards_select') THEN CREATE POLICY task_boards_select ON task_boards FOR SELECT USING (true); END IF; END $$`,
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_boards' AND policyname='task_boards_insert') THEN CREATE POLICY task_boards_insert ON task_boards FOR INSERT WITH CHECK (auth.uid() IS NOT NULL); END IF; END $$`,
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_boards' AND policyname='task_boards_update') THEN CREATE POLICY task_boards_update ON task_boards FOR UPDATE USING (auth.uid() IS NOT NULL); END IF; END $$`,
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_boards' AND policyname='task_boards_delete') THEN CREATE POLICY task_boards_delete ON task_boards FOR DELETE USING (owner_id = auth.uid()); END IF; END $$`,
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_columns' AND policyname='task_columns_all') THEN CREATE POLICY task_columns_all ON task_columns USING (true) WITH CHECK (auth.uid() IS NOT NULL); END IF; END $$`,
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tasks' AND policyname='tasks_all') THEN CREATE POLICY tasks_all ON tasks USING (true) WITH CHECK (auth.uid() IS NOT NULL); END IF; END $$`,
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_assignments' AND policyname='task_assignments_all') THEN CREATE POLICY task_assignments_all ON task_assignments USING (true) WITH CHECK (auth.uid() IS NOT NULL); END IF; END $$`,
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_comments' AND policyname='task_comments_all') THEN CREATE POLICY task_comments_all ON task_comments USING (true) WITH CHECK (auth.uid() IS NOT NULL); END IF; END $$`,
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_activity' AND policyname='task_activity_all') THEN CREATE POLICY task_activity_all ON task_activity USING (true) WITH CHECK (auth.uid() IS NOT NULL); END IF; END $$`,
        ]

        const results: string[] = []
        for (const sql of [...statements, ...rls]) {
            try {
                await client.query(sql)
                results.push('OK')
            } catch (e: any) {
                results.push(`WARN: ${e.message.substring(0, 100)}`)
            }
        }

        const verify = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'task%' ORDER BY tablename")
        await client.end()

        return NextResponse.json({ results: results.filter(r => r !== 'OK'), tables: verify.rows.map((r: any) => r.tablename) })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
