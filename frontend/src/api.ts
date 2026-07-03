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

/** Corps de POST /community (cf. jsonschema/create.json : name requis). */
export interface CommunityInput {
  name: string;
  description: string;
  icon: string;
}

function xsrfHeader(): Record<string, string> {
  const m = typeof document !== 'undefined' ? document.cookie.match(/XSRF-TOKEN=([^;]+)/) : null;
  return m ? { 'X-XSRF-TOKEN': decodeURIComponent(m[1]) } : {};
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(String(res.status));
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

const baseOpt = { credentials: 'include' as const };
const mutHeaders = () => ({ 'Content-Type': 'application/json', ...xsrfHeader() });

// ── Lecture ─────────────────────────────────────────────────────────────────────
/** Communautés de l'utilisateur (200 + [] si aucune). */
export const getCommunities = async (): Promise<Community[]> =>
  json<Community[]>(await fetch(`/community/list`, baseOpt));

/** Annuaire des destinataires visibles (utilisateurs + groupes). */
export const getVisibles = async (): Promise<Visibles> => {
  const d = await json<{ users?: VisibleUser[]; groups?: VisibleGroup[] }>(await fetch(`/community/visibles`, baseOpt));
  return { users: d?.users ?? [], groups: d?.groups ?? [] };
};

// ── Écriture ──────────────────────────────────────────────────────────────────
/** Crée une communauté (POST /community). Renvoie la communauté créée (dont son id). */
export const createCommunity = async (input: CommunityInput): Promise<{ id: string }> =>
  json<{ id: string }>(
    await fetch(`/community`, { ...baseOpt, method: 'POST', headers: mutHeaders(), body: JSON.stringify(input) }),
  );

/** Supprime une communauté (DELETE /community/:id). */
export const deleteCommunity = async (id: string): Promise<void> => {
  const res = await fetch(`/community/${id}`, { ...baseOpt, method: 'DELETE', headers: xsrfHeader() });
  if (!res.ok && res.status !== 204) throw new Error(String(res.status));
};

export const api = { getCommunities, getVisibles, createCommunity, deleteCommunity };
