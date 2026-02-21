-- Create table for persisting AI match scores
CREATE TABLE IF NOT EXISTS public.match_results (
    candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
    score FLOAT NOT NULL,
    reasoning TEXT,
    recommendation TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (candidate_id, project_id)
);
-- Enable RLS
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;
-- Allow authenticated users to read and write matches
CREATE POLICY "Allow authenticated users to read matches" ON public.match_results FOR
SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated users to insert/update matches" ON public.match_results FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_match_results_candidate ON public.match_results(candidate_id);
CREATE INDEX IF NOT EXISTS idx_match_results_project ON public.match_results(project_id);