import React from 'react';
import { Brand, GeneratedAsset } from '../types';

interface QoollineHubProps {
  brand: Brand;
  addToHistory: (asset: GeneratedAsset) => void;
}

const QoollineHub: React.FC<QoollineHubProps> = ({ brand }) => {
  return (
    <div className="p-4 lg:p-6 h-screen overflow-y-auto">
      <h2 className="text-3xl font-serif text-white mb-2">Qoolline Hub</h2>
      <p className="text-slate-400 text-sm mb-6">Kampanya fabrikasi, kalite kontrol ve icerik uretimi</p>
      <p className="text-slate-500">Loading...</p>
    </div>
  );
};

export default QoollineHub;
