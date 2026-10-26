import { MediaLibrary, useEdificeClient, useMediaLibrary } from '@open-ent/react';
import { useTranslation } from 'react-i18next';

import { iconPath, iconSrc } from '../utils';

/**
 * Choix de l'icône d'une communauté dans la médiathèque (comme `image-select` de l'ancienne interface).
 * Le document est public : l'icône doit rester visible de tous les membres, pas seulement de qui l'a choisie.
 */
export function IconPicker({ value, onChange }: { value: string; onChange: (icon: string) => void }) {
  const { t } = useTranslation(['community']);
  const { appCode } = useEdificeClient();
  const { ref, ...handlers } = useMediaLibrary();
  const src = iconSrc(value);

  return (
    <div className="d-flex align-items-center gap-12" data-community-icon-picker>
      {src ? (
        <img src={src} alt="" width={64} height={64} style={{ objectFit: 'cover', borderRadius: 8 }} data-community-icon-preview />
      ) : (
        <div style={{ width: 64, height: 64, borderRadius: 8, background: '#eef1f4' }} aria-hidden="true" data-community-icon-empty />
      )}
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => ref.current?.show('image')} data-community-icon-choose>
        {t('community.icon.choose', { defaultValue: "Choisir une icône" })}
      </button>
      {value && (
        <button type="button" className="btn btn-link btn-sm" onClick={() => onChange('')} data-community-icon-remove>
          {t('community.icon.remove', { defaultValue: "Retirer l'icône" })}
        </button>
      )}
      <MediaLibrary
        appCode={appCode}
        ref={ref}
        visibility="public"
        {...handlers}
        onSuccess={(result) => {
          const doc = (Array.isArray(result) ? result[0] : result) as { _id?: string } | undefined;
          if (doc?._id) onChange(iconPath(doc._id, true));
          handlers.onSuccess(result);
        }}
      />
    </div>
  );
}
