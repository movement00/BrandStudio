import React from 'react';
import { Check, Globe } from 'lucide-react';
import { QoollineCountryTheme } from '../../types';
import { QOOLLINE_COUNTRIES, QOOLLINE_CAMPAIGNS } from '../../services/qoollineService';

interface CountryThemesProps {
  selectedCountries: Set<string>;
  onToggleCountry: (id: string) => void;
  selectedCampaignId: string;
  onCampaignChange: (id: string) => void;
}

const CountryThemes: React.FC<CountryThemesProps> = ({ selectedCountries, onToggleCountry, selectedCampaignId, onCampaignChange }) => {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-white flex items-center gap-2">
        <Globe size={14} className="text-lumina-gold" />
        Ulke Temali Icerik
      </h3>

      <div>
        <p className="text-[10px] text-slate-500 mb-1.5">Kampanya Tipi</p>
        <select value={selectedCampaignId} onChange={e => onCampaignChange(e.target.value)} className="w-full bg-lumina-900 border border-lumina-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-lumina-gold/50">
          {QOOLLINE_CAMPAIGNS.map(c => (<option key={c.id} value={c.id}>{c.type}</option>))}
        </select>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {QOOLLINE_COUNTRIES.map(country => {
          const isSelected = selectedCountries.has(country.id);
          return (
            <button key={country.id} onClick={() => onToggleCountry(country.id)} className={`text-left p-3 rounded-lg border transition-all ${isSelected ? 'border-lumina-gold/50 bg-lumina-gold/5' : 'border-lumina-800 bg-lumina-900 hover:border-lumina-700'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 ${isSelected ? 'bg-lumina-gold border-lumina-gold' : 'border-lumina-700'}`}>
                  {isSelected && <Check size={10} className="text-lumina-950" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-white">{country.emoji} {country.country}</p>
                  <p className="text-[10px] text-lumina-gold mt-0.5">{country.localizedMessage}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {country.visualKeywords.slice(0, 3).map(kw => (
                      <span key={kw} className="text-[9px] text-slate-500 bg-lumina-950 px-1.5 py-0.5 rounded">{kw}</span>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CountryThemes;
