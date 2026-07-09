export const BRAND = {
  name: 'Livraria Adventista',
  shortName: 'LA',
  tagline: 'Literatura que edifica e transforma',
  email: 'contacto@livrariaadventista.ao',
  phone: '+244 923 000 000',
  address: 'Luanda, Angola',
};

export function pageTitle(suffix) {
  return suffix ? `${suffix} — ${BRAND.name}` : BRAND.name;
}
