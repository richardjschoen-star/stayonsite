-- Portal tables. Better Auth owns "user", session, account, verification, rateLimit (0001).
-- Ids are TEXT, timestamps are ms integers, calendar dates are 'YYYY-MM-DD', JSON is TEXT.
-- ponytail: JSON arrays (members, subtasks, reactions) are last-write-wins; split into tables if concurrent edits clash.

CREATE TABLE org (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT 'indigo',
  version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE member (
  org_id TEXT NOT NULL REFERENCES org(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'guest')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX member_user ON member(user_id);

-- org_id NULL is a staff invite.
CREATE TABLE invite (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  org_id TEXT REFERENCES org(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'guest', 'staff')),
  invited_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX invite_email_org ON invite(email, COALESCE(org_id, ''));

CREATE TABLE team (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES org(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'users',
  color TEXT NOT NULL DEFAULT '#6B7280',
  description TEXT NOT NULL DEFAULT '',
  lead_id TEXT,
  members TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);
CREATE INDEX team_org ON team(org_id);

CREATE TABLE project (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES org(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'folder',
  color TEXT NOT NULL DEFAULT 'indigo',
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'risk', 'hold', 'complete')),
  team_id TEXT REFERENCES team(id) ON DELETE SET NULL,
  lead_id TEXT,
  start TEXT,
  due TEXT,
  description TEXT NOT NULL DEFAULT '',
  -- {userId: 'view' | 'comment' | 'edit' | 'full'}
  members TEXT NOT NULL DEFAULT '{}',
  -- [{id, name, date}]
  milestones TEXT NOT NULL DEFAULT '[]',
  private INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  ord REAL NOT NULL DEFAULT 0,
  template TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (org_id, key)
);

-- One row per step of the engagement process.
CREATE TABLE stage (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  n INTEGER NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('sales', 'delivery')),
  name TEXT NOT NULL,
  length TEXT NOT NULL DEFAULT '',
  owner_id TEXT,
  due TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'active', 'done', 'skipped')),
  gate TEXT CHECK (gate IN ('sign', 'approve', 'go', 'accept')),
  decision TEXT CHECK (decision IN ('approved', 'rejected')),
  decided_by TEXT,
  decided_at INTEGER,
  decided_file_id TEXT,
  decided_ip TEXT,
  decision_note TEXT,
  -- [{id, text, done}]
  items TEXT NOT NULL DEFAULT '[]',
  UNIQUE (project_id, n)
);

CREATE TABLE task (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  num INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('backlog', 'todo', 'progress', 'review', 'done')),
  priority TEXT NOT NULL DEFAULT 'none' CHECK (priority IN ('urgent', 'high', 'medium', 'low', 'none')),
  assignee_id TEXT,
  start TEXT,
  due TEXT,
  labels TEXT NOT NULL DEFAULT '[]',
  deps TEXT NOT NULL DEFAULT '[]',
  -- [{id, title, done}]
  subtasks TEXT NOT NULL DEFAULT '[]',
  description TEXT NOT NULL DEFAULT '',
  estimate TEXT,
  recur TEXT,
  ord REAL NOT NULL DEFAULT 0,
  stage_id TEXT REFERENCES stage(id) ON DELETE SET NULL,
  internal INTEGER NOT NULL DEFAULT 0,
  completed_at INTEGER,
  archived INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (project_id, num)
);

CREATE TABLE comment (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES task(id) ON DELETE CASCADE,
  stage_id TEXT REFERENCES stage(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  body TEXT NOT NULL,
  -- {emoji: [userId]}
  reactions TEXT NOT NULL DEFAULT '{}',
  internal INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  edited_at INTEGER
);
CREATE INDEX comment_project ON comment(project_id);

-- The bytes live in R2 under `${org_id}/${id}`.
CREATE TABLE file (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES org(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES project(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES task(id) ON DELETE SET NULL,
  stage_id TEXT REFERENCES stage(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  internal INTEGER NOT NULL DEFAULT 0,
  uploaded_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX file_org ON file(org_id);

CREATE TABLE event (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES org(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES project(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX event_org ON event(org_id);

-- Overdue is derived: status 'sent' and due < today.
CREATE TABLE invoice (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES org(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES project(id) ON DELETE SET NULL,
  number TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void')),
  issued TEXT,
  due TEXT,
  file_id TEXT REFERENCES file(id) ON DELETE SET NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  UNIQUE (org_id, number)
);

-- Append-only.
CREATE TABLE activity (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES org(id) ON DELETE CASCADE,
  project_id TEXT,
  task_id TEXT,
  stage_id TEXT,
  actor_id TEXT NOT NULL,
  verb TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  internal INTEGER NOT NULL DEFAULT 0,
  at INTEGER NOT NULL
);
CREATE INDEX activity_org_at ON activity(org_id, at DESC);

CREATE TABLE notif (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES org(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mention', 'assign', 'comment', 'update', 'approval', 'invoice')),
  actor_id TEXT NOT NULL,
  project_id TEXT,
  task_id TEXT,
  stage_id TEXT,
  text TEXT NOT NULL,
  snippet TEXT NOT NULL DEFAULT '',
  read INTEGER NOT NULL DEFAULT 0,
  at INTEGER NOT NULL
);
CREATE INDEX notif_user_at ON notif(user_id, org_id, at DESC);

-- user_id NULL is a view shared with everyone on the project.
CREATE TABLE saved_view (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES org(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES project(id) ON DELETE CASCADE,
  user_id TEXT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('board', 'list', 'table', 'calendar', 'timeline')),
  filters TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL
);

CREATE TABLE favorite (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  org_id TEXT NOT NULL REFERENCES org(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('project', 'task')),
  ref_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind, ref_id)
);
