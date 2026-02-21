-- ============================================================================
-- QUALRIX DATABASE SETUP - M1 DASHBOARD
-- Run this entire script in Supabase SQL Editor
-- ============================================================================
-- ============================================================================
-- PART 1: NOTIFICATIONS SYSTEM
-- ============================================================================
-- Drop existing notifications table if exists (for clean setup)
DROP TABLE IF EXISTS notifications CASCADE;
-- Create notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Notification content (bilingual support)
    type TEXT NOT NULL CHECK (
        type IN (
            'contract_ending',
            -- Kontrakt kończy się
            'health_score_low',
            -- Niska kondycja kontraktu
            'new_project_match',
            -- Nowy matching projekt
            'loyalty_tier_up',
            -- Awans tier w programie lojalnościowym
            'referral_update',
            -- Aktualizacja rekomendacji
            'document_uploaded',
            -- Nowy dokument
            'system_announcement',
            -- Ogłoszenie systemowe
            'payment_received' -- Płatność otrzymana
        )
    ),
    title_pl TEXT NOT NULL,
    title_en TEXT NOT NULL,
    body_pl TEXT,
    body_en TEXT,
    -- Action & Metadata
    action_url TEXT,
    -- Optional link to action
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    -- Read status
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ -- Optional expiry date
);
-- Indexes for performance
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON notifications(is_read)
WHERE is_read = FALSE;
CREATE INDEX idx_notifications_type ON notifications(type);
-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- RLS Policies
-- Users can view their own notifications
CREATE POLICY "Users can view own notifications" ON notifications FOR
SELECT TO authenticated USING (auth.uid() = user_id);
-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications" ON notifications FOR
UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
-- Admins can insert notifications for any user
CREATE POLICY "Admins can insert notifications" ON notifications FOR
INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
                AND profiles.role = 'admin'
        )
    );
-- Users can insert notifications for themselves
CREATE POLICY "Users can insert own notifications" ON notifications FOR
INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
-- Helper function to create notifications
CREATE OR REPLACE FUNCTION create_notification(
        p_user_id UUID,
        p_type TEXT,
        p_title_pl TEXT,
        p_title_en TEXT,
        p_body_pl TEXT DEFAULT NULL,
        p_body_en TEXT DEFAULT NULL,
        p_action_url TEXT DEFAULT NULL,
        p_priority TEXT DEFAULT 'normal'
    ) RETURNS UUID AS $$
DECLARE v_notification_id UUID;
BEGIN
INSERT INTO notifications (
        user_id,
        type,
        title_pl,
        title_en,
        body_pl,
        body_en,
        action_url,
        priority
    )
VALUES (
        p_user_id,
        p_type,
        p_title_pl,
        p_title_en,
        p_body_pl,
        p_body_en,
        p_action_url,
        p_priority
    )
RETURNING id INTO v_notification_id;
RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_notification TO authenticated;
-- Function to expire old notifications (run via cron)
CREATE OR REPLACE FUNCTION expire_old_notifications() RETURNS void AS $$ BEGIN
DELETE FROM notifications
WHERE expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
-- Grant execute permission
GRANT EXECUTE ON FUNCTION expire_old_notifications TO authenticated;
-- ============================================================================
-- PART 2: CONTRACTS TABLE
-- ============================================================================
-- Drop existing contracts table if exists (for clean setup)
DROP TABLE IF EXISTS contracts CASCADE;
-- Create contracts table
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Consultant reference
    consultant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    -- Contract details
    contract_number TEXT,
    -- e.g. "B2B/2024/001"
    client_name TEXT NOT NULL,
    project_name TEXT NOT NULL,
    position TEXT NOT NULL,
    -- e.g. "Senior Java Developer"
    -- Dates
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    original_end_date DATE,
    -- For tracking extensions
    extension_count INT DEFAULT 0,
    -- Financial
    hourly_rate DECIMAL(10, 2),
    -- PLN per hour
    monthly_rate DECIMAL(10, 2),
    -- Fixed monthly rate (if applicable)
    currency TEXT DEFAULT 'PLN',
    -- Work arrangement
    work_mode TEXT CHECK (work_mode IN ('remote', 'hybrid', 'onsite')),
    work_location TEXT,
    -- City or office location
    hours_per_week INT DEFAULT 40,
    -- Status
    status TEXT NOT NULL DEFAULT 'active' CHECK (
        status IN (
            'draft',
            -- Contract being prepared
            'active',
            -- Current ongoing contract
            'ending_soon',
            -- < 30 days to end_date
            'extended',
            -- Contract was extended
            'completed',
            -- Successfully finished
            'terminated',
            -- Ended early
            'cancelled' -- Cancelled before start
        )
    ),
    -- Health & Performance (for M4)
    health_score DECIMAL(5, 2) DEFAULT 85.00,
    -- 0-100%
    last_health_check TIMESTAMPTZ,
    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    -- Soft delete
    deleted_at TIMESTAMPTZ
);
-- Indexes
CREATE INDEX idx_contracts_consultant ON contracts(consultant_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_end_date ON contracts(end_date);
CREATE INDEX idx_contracts_health ON contracts(health_score);
-- Enable RLS
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
-- RLS Policies
-- Consultants can view their own contracts
CREATE POLICY "Consultants can view own contracts" ON contracts FOR
SELECT TO authenticated USING (auth.uid() = consultant_id);
-- Admins can view all contracts
CREATE POLICY "Admins can view all contracts" ON contracts FOR
SELECT TO authenticated USING (
        EXISTS (
            SELECT 1
            FROM profiles
            WHERE profiles.id = auth.uid()
                AND profiles.role = 'admin'
        )
    );
-- Admins can manage all contracts
CREATE POLICY "Admins can manage contracts" ON contracts FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
    )
) WITH CHECK (
    EXISTS (
        SELECT 1
        FROM profiles
        WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
    )
);
-- Auto-update trigger for updated_at
CREATE OR REPLACE FUNCTION update_contracts_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER contracts_updated_at BEFORE
UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION update_contracts_updated_at();
-- Function to auto-update contract status based on dates
CREATE OR REPLACE FUNCTION update_contract_status() RETURNS void AS $$ BEGIN -- Mark as ending_soon if < 30 days
UPDATE contracts
SET status = 'ending_soon'
WHERE status = 'active'
    AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days';
-- Mark as completed if past end date
UPDATE contracts
SET status = 'completed'
WHERE status IN ('active', 'ending_soon')
    AND end_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;
-- Grant execute
GRANT EXECUTE ON FUNCTION update_contract_status TO authenticated;
-- ============================================================================
-- PART 3: ADD LOYALTY FIELDS TO PROFILES (if not exist)
-- ============================================================================
-- Add loyalty fields to profiles table (safe - only if not exist)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles'
        AND column_name = 'loyalty_points'
) THEN
ALTER TABLE profiles
ADD COLUMN loyalty_points INT DEFAULT 0;
END IF;
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'profiles'
        AND column_name = 'loyalty_tier'
) THEN
ALTER TABLE profiles
ADD COLUMN loyalty_tier TEXT DEFAULT 'bronze' CHECK (
        loyalty_tier IN ('bronze', 'silver', 'gold', 'platinum')
    );
END IF;
END $$;
-- ============================================================================
-- PART 4: SAMPLE DATA FOR TESTING
-- ============================================================================
-- Insert sample contracts for the first consultant user
DO $$
DECLARE v_test_user_id UUID;
BEGIN -- Get first non-admin user
SELECT id INTO v_test_user_id
FROM profiles
WHERE role = 'consultant'
LIMIT 1;
-- If found, insert sample contracts
IF v_test_user_id IS NOT NULL THEN -- Delete existing test contracts for clean setup
DELETE FROM contracts
WHERE consultant_id = v_test_user_id;
INSERT INTO contracts (
        consultant_id,
        contract_number,
        client_name,
        project_name,
        position,
        start_date,
        end_date,
        hourly_rate,
        work_mode,
        work_location,
        status,
        health_score
    )
VALUES -- Active contract (healthy)
    (
        v_test_user_id,
        'B2B/2024/001',
        'PKO Bank Polski',
        'Core Banking System Migration',
        'Senior Java Developer',
        '2024-01-15',
        '2026-12-31',
        180.00,
        'hybrid',
        'Warszawa',
        'active',
        92.50
    ),
    -- Contract ending soon
    (
        v_test_user_id,
        'B2B/2023/042',
        'mBank',
        'Mobile Banking App',
        'React Native Developer',
        '2023-06-01',
        '2026-03-15',
        175.00,
        'remote',
        'Remote',
        'ending_soon',
        78.00
    ),
    -- Recently completed
    (
        v_test_user_id,
        'B2B/2023/015',
        'Pekao S.A.',
        'Payment Gateway Integration',
        'Backend Developer',
        '2023-01-10',
        '2025-12-20',
        165.00,
        'onsite',
        'Warszawa',
        'completed',
        88.00
    ),
    -- Extended contract
    (
        v_test_user_id,
        'B2B/2022/089',
        'ING Bank Śląski',
        'Data Warehouse Modernization',
        'Senior Data Engineer',
        '2022-03-01',
        '2027-06-30',
        195.00,
        'hybrid',
        'Katowice',
        'extended',
        95.00
    );
RAISE NOTICE 'Sample contracts created for user: %',
v_test_user_id;
-- Insert sample notifications
PERFORM create_notification(
    v_test_user_id,
    'contract_ending',
    'Kontrakt kończy się za 30 dni',
    'Contract ending in 30 days',
    'Twój kontrakt z mBank kończy się 15 marca 2026. Rozważ przedłużenie.',
    'Your contract with mBank ends on March 15, 2026. Consider extension.',
    '/contracts',
    'high'
);
PERFORM create_notification(
    v_test_user_id,
    'new_project_match',
    'Nowy projekt dopasowany do Twojego profilu',
    'New project matches your profile',
    '3 nowe projekty pasują do Twoich umiejętności. Zobacz teraz!',
    '3 new projects match your skills. Check them now!',
    '/projects',
    'normal'
);
RAISE NOTICE 'Sample notifications created for user: %',
v_test_user_id;
ELSE RAISE NOTICE 'No consultant users found. Create a test user first.';
END IF;
END $$;
-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Check notifications table
SELECT 'Notifications table created' as status,
    COUNT(*) as notification_count
FROM notifications;
-- Check contracts table
SELECT 'Contracts table created' as status,
    COUNT(*) as contract_count
FROM contracts;
-- Check RLS policies
SELECT 'RLS Policies' as status,
    tablename,
    policyname
FROM pg_policies
WHERE tablename IN ('notifications', 'contracts')
ORDER BY tablename,
    policyname;
-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================
SELECT '✅ Database setup complete!' as message,
    (
        SELECT COUNT(*)
        FROM notifications
    ) as notifications_created,
    (
        SELECT COUNT(*)
        FROM contracts
    ) as contracts_created;