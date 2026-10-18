import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { useEdificeClient } from '@open-ent/react';

import { api, CommunityMember } from '../api';
import { byLabel, roleLabel } from '../utils';

/** Bloc « membres d'un rôle » (Gestionnaires / Contributeurs / Lecteurs), avec retrait. */
function MemberList({ label, members, onRemove, selfId, removeLabel }: { label: string; members: CommunityMember[]; onRemove: (id: string) => void; selfId?: string; removeLabel: string }) {
  return (
    <div className="mb-12">
      <h3 style={{ fontSize: 15 }} className="mb-8">
        {label} <span className="text-muted" style={{ fontSize: 13 }}>({members.length})</span>
      </h3>
      {members.length === 0 ? (
        <p className="text-muted mb-0" style={{ fontSize: 14 }}>—</p>
      ) : (
        <ul className="list-unstyled mb-0">
          {members.map((m) => (
            <li key={m.id} className="py-4 border-bottom d-flex justify-content-between align-items-center">
              <span>{m.displayName ?? m.username ?? m.id}</span>
              {/* On ne peut pas se retirer soi-même (parité AngularJS : la ligne « Moi » est verrouillée). */}
              {m.id !== selfId && (
                <button type="button" className="btn btn-link p-0 text-danger" aria-label={`${removeLabel} ${m.displayName ?? m.id}`} onClick={() => onRemove(m.id)}>×</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Détail d'une communauté : informations, groupes par rôle (services) et membres
 * (gestionnaires / contributeurs / lecteurs), plus l'accès à la page de la communauté.
 */
export function Detail() {
  const { t } = useTranslation(['community', 'common']);
  const { id = '' } = useParams();
  const { user } = useEdificeClient();
  const selfId = (user as { userId?: string } | undefined)?.userId;

  const qc = useQueryClient();
  const detailsQuery = useQuery({ queryKey: ['community', 'details', id], queryFn: () => api.getDetails(id), enabled: !!id });
  const membersQuery = useQuery({ queryKey: ['community', 'members', id], queryFn: () => api.getMembers(id), enabled: !!id });
  const visiblesQuery = useQuery({ queryKey: ['community', 'visibles'], queryFn: () => api.getVisibles() });

  const d = detailsQuery.data;
  const m = membersQuery.data;

  const [actionError, setActionError] = useState('');
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'read' | 'contrib' | 'manager'>('read');
  const invalidate = () => qc.invalidateQueries({ queryKey: ['community', 'members', id] });

  const inviteMut = useMutation({
    mutationFn: () => api.manageMembers(id, { [role]: [userId] }),
    onSuccess: () => { setUserId(''); setActionError(''); invalidate(); },
    onError: () => setActionError(t('community.members.error', { defaultValue: "La mise à jour des membres a échoué (droit insuffisant ou erreur du serveur)." })),
  });
  const removeMut = useMutation({
    mutationFn: (uid: string) => api.manageMembers(id, { delete: [uid] }),
    onSuccess: () => { setActionError(''); invalidate(); },
    onError: () => setActionError(t('community.members.error', { defaultValue: "La mise à jour des membres a échoué (droit insuffisant ou erreur du serveur)." })),
  });

  // Le gestionnaire connecté n'est pas proposé à l'invitation (il est déjà membre).
  const users = byLabel((visiblesQuery.data?.users ?? []).filter((u) => u.id !== selfId), (u) => u.username).slice(0, 200);
  const askRemove = (uid: string, members: CommunityMember[]) => {
    const who = members.find((x) => x.id === uid);
    if (window.confirm(t('community.member.remove.confirm', { defaultValue: 'Retirer [[name]] de la communauté ?', name: who?.displayName ?? who?.username ?? uid }))) removeMut.mutate(uid);
  };

  return (
    <div>
      <div className="mb-16">
        <Link to="/" className="btn btn-link p-0">← {t('community.back', { defaultValue: 'Retour aux communautés' })}</Link>
      </div>

      {detailsQuery.isLoading && <p>{t('community.loading', { defaultValue: 'Chargement…' })}</p>}
      {detailsQuery.isError && (
        <div className="alert alert-warning" role="alert">
          {t('community.details.error', { defaultValue: "Impossible de charger cette communauté." })}
        </div>
      )}

      {d && (
        <>
          <h1 className="mb-8">{d.name}</h1>
          {d.description && <p className="text-muted mb-16">{d.description}</p>}

          <div className="d-flex gap-16 flex-wrap align-items-start">
            {/* Membres par rôle */}
            <section className="card p-16 flex-grow-1" style={{ minWidth: 320 }}>
              <h2 style={{ fontSize: 18 }} className="mb-12">{t('community.members', { defaultValue: 'Membres' })}</h2>
              {actionError && <div className="alert alert-warning" role="alert" data-community-error>{actionError}</div>}
              {membersQuery.isError && <div className="alert alert-warning" role="alert">{t('community.members.load.error', { defaultValue: 'Impossible de charger les membres.' })}</div>}
              {membersQuery.isLoading && <p>{t('community.loading', { defaultValue: 'Chargement…' })}</p>}
              {m && (
                <>
                  <MemberList label={t('community.role.manager', { defaultValue: 'Gestionnaires' })} members={m.manager} onRemove={(uid) => askRemove(uid, m.manager)} selfId={selfId} removeLabel={t('community.member.remove', { defaultValue: 'Retirer' })} />
                  <MemberList label={t('community.role.contrib', { defaultValue: 'Contributeurs' })} members={m.contrib} onRemove={(uid) => askRemove(uid, m.contrib)} selfId={selfId} removeLabel={t('community.member.remove', { defaultValue: 'Retirer' })} />
                  <MemberList label={t('community.role.read', { defaultValue: 'Lecteurs' })} members={m.read} onRemove={(uid) => askRemove(uid, m.read)} selfId={selfId} removeLabel={t('community.member.remove', { defaultValue: 'Retirer' })} />
                </>
              )}

              {/* Invitation d'un membre */}
              <form
                className="d-flex gap-8 flex-wrap align-items-end mt-8"
                onSubmit={(e) => { e.preventDefault(); if (userId) inviteMut.mutate(); }}
              >
                <div className="flex-grow-1">
                  <label htmlFor="comm-invite-user" className="form-label">{t('community.invite.user', { defaultValue: 'Inviter un utilisateur' })}</label>
                  <select id="comm-invite-user" className="form-select" value={userId} onChange={(e) => setUserId(e.target.value)}>
                    <option value="">{t('community.invite.choose', { defaultValue: '— Choisir —' })}</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="comm-invite-role" className="form-label">{t('community.invite.role', { defaultValue: 'Rôle' })}</label>
                  <select id="comm-invite-role" className="form-select" value={role} onChange={(e) => setRole(e.target.value as 'read' | 'contrib' | 'manager')}>
                    <option value="read">{t('community.role.read.one', { defaultValue: 'Lecteur' })}</option>
                    <option value="contrib">{t('community.role.contrib.one', { defaultValue: 'Contributeur' })}</option>
                    <option value="manager">{t('community.role.manager.one', { defaultValue: 'Gestionnaire' })}</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary" disabled={!userId || inviteMut.isPending}>
                  {t('community.invite.submit', { defaultValue: 'Inviter' })}
                </button>
              </form>
            </section>

            {/* Groupes (services) + page */}
            <section className="card p-16 flex-grow-1" style={{ minWidth: 280 }}>
              <h2 style={{ fontSize: 18 }} className="mb-12">{t('community.groups.title', { defaultValue: 'Groupes de la communauté' })}</h2>
              {d.groups && d.groups.length > 0 ? (
                <ul className="list-unstyled mb-16">
                  {d.groups.map((g) => (
                    <li key={g.id} className="py-4 border-bottom d-flex justify-content-between gap-8">
                      <span>{g.name}</span>
                      <span className="text-muted" style={{ fontSize: 13 }}>{roleLabel(g.type)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">—</p>
              )}

              {d.pageId && (
                <a className="btn btn-secondary" href={`/pages#/website/${d.pageId}/view`} target="_blank" rel="noopener noreferrer">
                  {t('community.page.open', { defaultValue: 'Ouvrir la page de la communauté' })}
                </a>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

export default Detail;
