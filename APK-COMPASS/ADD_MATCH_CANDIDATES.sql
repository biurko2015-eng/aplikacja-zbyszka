-- Create matching function for candidates (Cosine Similarity)
create or replace function match_candidates (
        query_embedding vector(1536),
        match_threshold float,
        match_count int
    ) returns table (
        id uuid,
        full_name text,
        avatar_url text,
        job_title text,
        similarity float
    ) language plpgsql as $$ begin return query
select candidates.id,
    candidates.full_name,
    candidates.avatar_url,
    candidates.current_status as job_title,
    1 - (candidates.embedding <=> query_embedding) as similarity
from candidates
where 1 - (candidates.embedding <=> query_embedding) > match_threshold
order by candidates.embedding <=> query_embedding
limit match_count;
end;
$$;