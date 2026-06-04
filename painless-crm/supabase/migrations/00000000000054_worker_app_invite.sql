-- Worker app access: link a worker invitation to its worker record so that
-- accepting the invite both provisions the auth account AND sets workers.user_id
-- (the existing FK that the worker PWA resolves via current_user_worker_id()).
--
-- Nullable: office-staff invitations created by inviteUser leave worker_id null;
-- only inviteWorker (worker detail page) populates it.

alter table user_invitations
  add column if not exists worker_id uuid references workers(id);

create index if not exists user_invitations_worker_id_idx
  on user_invitations(worker_id);
