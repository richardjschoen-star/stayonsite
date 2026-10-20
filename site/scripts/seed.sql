-- Local demo data: one staff invite and one client workspace with an invited owner.
-- Sign in at /console/login with either email; the code prints in the dev terminal.
INSERT OR IGNORE INTO invite (id, email, name, org_id, role, invited_by, created_at, expires_at)
VALUES ('seed-staff', 'dev@stayon.site', 'Dev Staff', NULL, 'staff', 'seed', 0, 4102444800000);

INSERT OR IGNORE INTO org (id, name, slug, color, version, created_at)
VALUES ('seed-acme', 'Acme Logistics (demo)', 'acme-demo', 'blue', 0, 0);

INSERT OR IGNORE INTO invite (id, email, name, org_id, role, invited_by, created_at, expires_at)
VALUES ('seed-client', 'client@example.com', 'Demo Client', 'seed-acme', 'owner', 'seed', 0, 4102444800000);
