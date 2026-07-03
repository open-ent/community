// Client REST du module Communautés (community) — session ENT, même origine.
// Incrément 1 : lecture seule (mes communautés + annuaire de partage).

/** Une communauté de l'utilisateur (celles où il est membre). */
export interface Community {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  types?: string[];
  groups?: Array<{ id: string; type: string; name: string }>;
}

/** Groupe visible pour le partage. */
export interface VisibleGroup {
  id: string;
  name: string;
}

/** Utilisateur visible pour le partage. */
export interface VisibleUser {
  id: string;
  username: string;
}

/** Annuaire des destinataires visibles pour un partage de communauté. */
export interface Visibles {
  users: VisibleUser[];
  groups: VisibleGroup[];
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(String(res.status));
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

const baseOpt = { credentials: 'include' as const };

// ── Lecture ─────────────────────────────────────────────────────────────────────
/** Communautés de l'utilisateur (200 + [] si aucune). */
export const getCommunities = async (): Promise<Community[]> =>
  json<Community[]>(await fetch(`/community/list`, baseOpt));

/** Annuaire des destinataires visibles (utilisateurs + groupes). */
export const getVisibles = async (): Promise<Visibles> => {
  const d = await json<{ users?: VisibleUser[]; groups?: VisibleGroup[] }>(await fetch(`/community/visibles`, baseOpt));
  return { users: d?.users ?? [], groups: d?.groups ?? [] };
};

export const api = { getCommunities, getVisibles };
