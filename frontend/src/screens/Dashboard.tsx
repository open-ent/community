import { useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { byLabel, highestRole, plural } from '../utils';

/** Tableau de bord Communautés : mes communautés (créer/supprimer) + annuaire des destinataires visibles. */
export function Dashboard() {
  const { t } = useTranslation(['community', 'common']);
  const { init } = useEdificeClient();
  const qc = useQueryClient();

  const communitiesQuery = useQuery({ queryKey: ['community', 'list'], queryFn: () => api.getCommunities() });
  const visiblesQuery = useQuery({ queryKey: ['community', 'visibles'], queryFn: () => api.getVisibles() });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState('');
  const invalidate = () => qc.invalidateQueries({ queryKey: ['community', 'list'] });

  const createMut = useMutation({
    mutationFn: () => api.createCommunity({ name: name.trim(), description: description.trim(), icon: '' }),
    onSuccess: () => { setName(''); setDescription(''); setFormError(''); invalidate(); },
    onError: () => setFormError(t('community.create.error', { defaultValue: "La création a échoué." })),
  });
  const deleteMut = useMutation({ mutationFn: (id: string) => api.deleteCommunity(id), onSuccess: invalidate });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setFormError(t('community.create.name.required', { defaultValue: 'Le nom est obligatoire.' })); return; }
    setFormError('');
    createMut.mutate();
  };

  const communities = byLabel(communitiesQuery.data ?? [], (c) => c.name);
  const groups = useMemo(() => byLabel(visiblesQuery.data?.groups ?? [], (g) => g.name).slice(0, 30), [visiblesQuery.data]);
  const usersCount = visiblesQuery.data?.users.length ?? 0;
  const groupsCount = visiblesQuery.data?.groups.length ?? 0;

  return (
    <div>
      <h1 className="mb-16">{t('community.title', { defaultValue: 'Communautés' })}</h1>

      {/* Mes communautés */}
      <section className="card p-16 mb-16">
        <h2 style={{ fontSize: 18 }} className="mb-12">
          {t('community.mine', { defaultValue: 'Mes communautés' })}{' '}
          <span className="text-muted" style={{ fontSize: 14 }}>({communities.length})</span>
        </h2>

        {/* Formulaire de création */}
        <form className="d-flex gap-8 flex-wrap align-items-end mb-12" onSubmit={onSubmit}>
          <div>
            <label htmlFor="comm-name" className="form-label">{t('community.name', { defaultValue: 'Nom' })}</label>
            <input id="comm-name" className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex-grow-1">
            <label htmlFor="comm-desc" className="form-label">{t('community.description', { defaultValue: 'Description' })}</label>
            <input id="comm-desc" className="form-control" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={createMut.isPending}>
            {t('community.create', { defaultValue: 'Créer la communauté' })}
          </button>
        </form>
        {formError && <div className="alert alert-warning" role="alert">{formError}</div>}

        {communitiesQuery.isLoading && <p>{t('community.loading', { defaultValue: 'Chargement…' })}</p>}
        {!communitiesQuery.isLoading && communities.length === 0 && (
          <p className="text-muted">
            {t('community.mine.empty', { defaultValue: "Vous n'êtes membre d'aucune communauté pour le moment." })}
          </p>
        )}
        {communities.length > 0 && (
          <table className="table mb-0">
            <thead>
              <tr>
                <th>{t('community.name', { defaultValue: 'Nom' })}</th>
                <th>{t('community.description', { defaultValue: 'Description' })}</th>
                <th>{t('community.role', { defaultValue: 'Mon rôle' })}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {communities.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="text-muted">{c.description ?? ''}</td>
                  <td>{highestRole(c.types)}</td>
                  <td className="text-end">
                    <button
                      type="button"
                      className="btn btn-link p-0 text-danger"
                      onClick={() => {
                        if (window.confirm(t('community.delete.confirm', { defaultValue: 'Supprimer cette communauté ?' }))) deleteMut.mutate(c.id);
                      }}
                    >
                      {t('community.delete', { defaultValue: 'Supprimer' })}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Annuaire de partage (destinataires visibles) */}
      <section className="card p-16">
        <h2 style={{ fontSize: 18 }} className="mb-12">{t('community.directory', { defaultValue: 'Annuaire de partage' })}</h2>
        {visiblesQuery.isLoading && <p>{t('community.loading', { defaultValue: 'Chargement…' })}</p>}
        {visiblesQuery.data && (
          <>
            <p className="text-muted mb-12">
              {plural(usersCount, t('community.user', { defaultValue: 'utilisateur' }), t('community.users', { defaultValue: 'utilisateurs' }))}
              {' · '}
              {plural(groupsCount, t('community.group', { defaultValue: 'groupe' }), t('community.groups', { defaultValue: 'groupes' }))}
              {' '}{t('community.directory.hint', { defaultValue: 'peuvent être invités dans une communauté.' })}
            </p>
            {groups.length > 0 && (
              <ul className="list-unstyled mb-0">
                {groups.map((g) => <li key={g.id} className="py-4 border-bottom">{g.name}</li>)}
              </ul>
            )}
          </>
        )}
      </section>
    </div>
  );
}

export default Dashboard;
