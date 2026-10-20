import assert from "node:assert/strict";
import { test } from "node:test";
import {
  atLeast,
  canDecide,
  canDeleteComment,
  canSetRole,
  projectPerm,
  seesInvoice,
  seesRow,
  type Viewer,
} from "./access.ts";

const staff: Viewer = { id: "s", staff: true, role: null };
const owner: Viewer = { id: "o", staff: false, role: "owner" };
const admin: Viewer = { id: "a", staff: false, role: "admin" };
const member: Viewer = { id: "m", staff: false, role: "member" };
const guest: Viewer = { id: "g", staff: false, role: "guest" };
const outsider: Viewer = { id: "x", staff: false, role: null };

const open = { private: 0, members: {} };
const secret = { private: 1, members: {} };

test("project visibility", () => {
  assert.equal(projectPerm(staff, secret), "full");
  assert.equal(projectPerm(outsider, open), null, "other orgs see nothing");
  assert.equal(projectPerm(admin, open), "edit");
  assert.equal(projectPerm(member, open), "comment");
  assert.equal(projectPerm(guest, open), null, "guests only see projects they're on");
  assert.equal(projectPerm(guest, { private: 0, members: { g: "view" } }), "view");
  assert.equal(projectPerm(owner, secret), null, "private means members only");
  assert.equal(projectPerm(member, { private: 1, members: { m: "full" } }), "full");
  assert.ok(atLeast("edit", "comment") && !atLeast("view", "comment") && !atLeast(null, "view"));
});

test("internal rows are staff-only", () => {
  assert.ok(seesRow(staff, { internal: 1 }));
  assert.ok(!seesRow(owner, { internal: 1 }));
  assert.ok(seesRow(member, { internal: 0 }));
});

test("only client owners and admins sign off an active gate", () => {
  const gate = { gate: "sign", status: "active", decision: null };
  assert.ok(canDecide(owner, gate));
  assert.ok(canDecide(admin, gate));
  assert.ok(!canDecide(member, gate));
  assert.ok(!canDecide(staff, gate), "staff can't sign for the client");
  assert.ok(!canDecide(owner, { ...gate, status: "todo" }));
  assert.ok(!canDecide(owner, { ...gate, gate: null }));
  assert.ok(!canDecide(owner, { ...gate, decision: "approved" }));
  assert.ok(canDecide(owner, { ...gate, decision: "rejected" }), "can decide again after asking for changes");
});

test("invoices: no drafts, owners and admins only", () => {
  assert.ok(seesInvoice(staff, { status: "draft" }));
  assert.ok(!seesInvoice(owner, { status: "draft" }));
  assert.ok(seesInvoice(admin, { status: "sent" }));
  assert.ok(!seesInvoice(member, { status: "sent" }));
});

test("roles: owners guard owners, never zero owners", () => {
  assert.ok(!canSetRole(member, null, "member", 1), "members can't invite");
  assert.ok(canSetRole(admin, null, "member", 1));
  assert.ok(!canSetRole(admin, null, "owner", 1), "admins can't mint owners");
  assert.ok(!canSetRole(admin, "owner", "member", 2), "admins can't demote owners");
  assert.ok(canSetRole(owner, "owner", "admin", 2));
  assert.ok(!canSetRole(owner, "owner", null, 1), "last owner stays");
  assert.ok(!canSetRole(staff, "owner", "member", 1), "not even staff removes the last owner");
  assert.ok(canSetRole(staff, null, "owner", 0));
});

test("comments", () => {
  assert.ok(canDeleteComment(member, { author_id: "m" }, "comment"));
  assert.ok(!canDeleteComment(member, { author_id: "o" }, "comment"));
  assert.ok(canDeleteComment(owner, { author_id: "m" }, "full"));
});
