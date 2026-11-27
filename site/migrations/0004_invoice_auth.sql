-- Staff authorization metadata on invoices.
ALTER TABLE invoice ADD COLUMN authorized_by TEXT;
ALTER TABLE invoice ADD COLUMN authorized_name TEXT;
ALTER TABLE invoice ADD COLUMN authorized_title TEXT;
ALTER TABLE invoice ADD COLUMN authorized_at INTEGER;
