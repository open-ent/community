import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import { api, CommunityMember } from '../api';
import { roleLabel } from '../utils';

/** Bloc « membres d'un rôle » (Gestionnaires / Contributeurs / Lecteurs). */
function MemberList({ label, members }: { label: string; members: CommunityMember[] }) {
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
            <li key={m.id} className="py-4 border-bottom">{m.displayName ?? m.username ?? m.id}</li>
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

  const detailsQuery = useQuery({ queryKey: ['community', 'details', id], queryFn: () => api.getDetails(id), enabled: !!id });
  const membersQuery = useQuery({ queryKey: ['community', 'members', id], queryFn: () => api.getMembers(id), enabled: !!id });

  const d = detailsQuery.data;
  const m = membersQuery.data;

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
              {membersQuery.isLoading && <p>{t('community.loading', { defaultValue: 'Chargement…' })}</p>}
              {m && (
                <>
                  <MemberList label={t('community.role.manager', { defaultValue: 'Gestionnaires' })} members={m.manager} />
                  <MemberList label={t('community.role.contrib', { defaultValue: 'Contributeurs' })} members={m.contrib} />
                  <MemberList label={t('community.role.read', { defaultValue: 'Lecteurs' })} members={m.read} />
                </>
              )}
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
