import { useState, useEffect } from 'react';

interface MasterData {
  categories: string[];
  sizes: string[];
  departments: string[];
}

const DEFAULT_CATEGORIES = [
  'Schuhe',
  'Oberbekleidung',
  'Unterbekleidung',
  'Schutzbekleidung',
  'Accessoires',
  'Sonstiges',
];

const DEFAULT_SIZES = [
  'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL',
  '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50',
];

const DEFAULT_DEPARTMENTS = [
  'Verkauf',
  'Werkstatt',
  'Verwaltung',
  'Lager',
];

export const useMasterData = (): MasterData => {
  const [masterData, setMasterData] = useState<MasterData>({
    categories: DEFAULT_CATEGORIES,
    sizes: DEFAULT_SIZES,
    departments: DEFAULT_DEPARTMENTS,
  });

  useEffect(() => {
    const storedCategories = localStorage.getItem('clothing_categories');
    const storedSizes = localStorage.getItem('clothing_sizes');
    const storedDepartments = localStorage.getItem('departments');

    setMasterData({
      categories: storedCategories ? JSON.parse(storedCategories) : DEFAULT_CATEGORIES,
      sizes: storedSizes ? JSON.parse(storedSizes) : DEFAULT_SIZES,
      departments: storedDepartments ? JSON.parse(storedDepartments) : DEFAULT_DEPARTMENTS,
    });
  }, []);

  return masterData;
};
