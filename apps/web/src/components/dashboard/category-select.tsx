'use client';

import {
  CATEGORY_LABELS,
  DEPARTMENT_LABELS,
  ProductCategory,
  ProductDepartment,
  categoriesOfDepartment,
} from '@odalyan/shared';
import { useT } from '@/lib/i18n';

/**
 * Sélecteur de catégorie groupé par rayon.
 *
 * Les libellés viennent d'abord de l'i18n (les six catégories mode y sont
 * traduites depuis l'origine) ; à défaut on retombe sur `CATEGORY_LABELS` du
 * paquet partagé, qui reste la source unique pour les rayons ajoutés depuis.
 * Cela évite de dupliquer trente libellés dans deux fichiers.
 */
export function CategorySelect({
  value,
  onChange,
  className = 'input',
  id,
}: {
  value: ProductCategory;
  onChange: (category: ProductCategory) => void;
  className?: string;
  id?: string;
}) {
  const t = useT();
  const label = (c: ProductCategory) => {
    const key = `cat.${c}`;
    const translated = t(key);
    return translated === key ? CATEGORY_LABELS[c] : translated;
  };

  return (
    <select
      id={id}
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value as ProductCategory)}
    >
      {Object.values(ProductDepartment).map((dep) => (
        <optgroup key={dep} label={DEPARTMENT_LABELS[dep]}>
          {categoriesOfDepartment(dep).map((c) => (
            <option key={c} value={c}>
              {label(c)}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
