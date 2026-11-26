-- Project onboarding, mutual contract, and customizable milestone payments.
CREATE TABLE IF NOT EXISTS project_agreement (
  project_id TEXT PRIMARY KEY REFERENCES project(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL DEFAULT '',
  client_email TEXT NOT NULL DEFAULT '',
  client_company TEXT NOT NULL DEFAULT '',
  project_type TEXT NOT NULL DEFAULT 'website' CHECK (project_type IN ('website', 'mobile', 'both')),
  scope_description TEXT NOT NULL DEFAULT '',
  total_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  contract_title TEXT NOT NULL DEFAULT '',
  contract_body TEXT NOT NULL DEFAULT '',
  company_accepted_by TEXT,
  company_accepted_at INTEGER,
  client_accepted_by TEXT,
  client_accepted_at INTEGER,
  preview_shown_at INTEGER,
  handover_ready_at INTEGER,
  -- [{id, label, trigger, triggerLabel, percent, status, paidAt, paidBy, paymentMethod}]
  milestones TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);
