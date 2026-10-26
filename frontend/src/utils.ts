/** Fonctions pures du module Communautés, testables. */

/** Tri par libellé FR insensible casse/accents (sur un champ donné). */
export function byLabel<T>(items: T[], key: (t: T) => string): T[] {
  return [...items].sort((a, b) => key(a).localeCompare(key(b), 'fr', { sensitivity: 'base' }));
}

/** Rôle le plus élevé de l'utilisateur dans une communauté (manager > contrib > read). */
export function highestRole(types?: string[]): string {
  if (!types || types.length === 0) return '';
  if (types.includes('manager')) return 'Gestionnaire';
  if (types.includes('contrib')) return 'Contributeur';
  if (types.includes('read')) return 'Lecteur';
  return types[0];
}

/** Peut renommer ou supprimer : rôle gestionnaire seulement (les routes serveur le refusent aux autres). */
export function canManage(types?: string[]): boolean {
  return !!types?.includes('manager');
}

/** Comptage « N élément(s) » avec accord du pluriel. */
export function plural(n: number, singulier: string, pluriel: string): string {
  return `${n} ${n > 1 ? pluriel : singulier}`;
}

/** Libellé FR d'un rôle de communauté (read/contrib/manager). */
export function roleLabel(type: string): string {
  switch (type) {
    case 'manager':
      return 'Gestionnaire';
    case 'contrib':
      return 'Contributeur';
    case 'read':
      return 'Lecteur';
    default:
      return type;
  }
}

/** Adresse d'affichage de l'icône d'une communauté : vignette 150×150 d'un document de l'espace documentaire ; vide si aucune. */
export function iconSrc(icon?: string): string {
  if (!icon) return '';
  return icon.includes('?') ? icon : `${icon}?thumbnail=150x150`;
}

/**
 * Adresse à enregistrer pour un document choisi dans la médiathèque. Public (`/workspace/pub/document/`), il reste
 * lisible par tous les membres ; protégé, seul son propriétaire le verrait.
 */
export function iconPath(docId: string, isPublic: boolean): string {
  return `${isPublic ? '/workspace/pub/document/' : '/workspace/document/'}${docId}`;
}
