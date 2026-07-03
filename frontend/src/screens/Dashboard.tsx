import { useEdificeClient } from '@open-ent/react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { byLabel, highestRole, plural } from '../utils';

/** Tableau de bord Communautés : mes communautés + annuaire des destinataires visibles. */
export function Dashboard() {
  const { t } = useTranslation(['community', 'common']);
  const { init } = useEdificeClient();

  const communitiesQuery = useQuery({ queryKey: ['community', 'list'], queryFn: () => api.getCommunities() });
  const visiblesQuery = useQuery({ queryKey: ['community', 'visibles'], queryFn: () => api.getVisibles() });

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
              </tr>
            </thead>
            <tbody>
              {communities.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="text-muted">{c.description ?? ''}</td>
                  <td>{highestRole(c.types)}</td>
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
