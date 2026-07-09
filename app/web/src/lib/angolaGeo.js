/**
 * 21 províncias de Angola conforme RGPH 2024 (INE).
 * Lista canónica para selects administrativos.
 */
export const ANGOLA_PROVINCES_2024 = [
  'Cabinda',
  'Zaire',
  'Uíge',
  'Bengo',
  'Luanda',
  'Icolo e Bengo',
  'Cuanza Norte',
  'Cuanza Sul',
  'Malanje',
  'Lunda Norte',
  'Lunda Sul',
  'Moxico',
  'Moxico Leste',
  'Bié',
  'Huambo',
  'Benguela',
  'Namibe',
  'Huíla',
  'Cunene',
  'Cubango',
  'Cuando',
];

export const ANGOLA_GEO_VERSION = 'RGPH-2024';

export function buildFullDeliveryAddress({
  street = '',
  locality = '',
  municipality = '',
  province = '',
  reference = '',
} = {}) {
  const parts = [street, locality, municipality, province].filter(Boolean);
  let full = parts.join(', ');
  if (reference) full += (full ? ' — ' : '') + `Ref: ${reference}`;
  if (full) full += ', Angola';
  return full;
}
