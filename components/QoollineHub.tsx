import React, { useState, useCallback } from 'react';
import { Zap, FileText, Globe, Sparkles, Loader2, Download } from 'lucide-react';
import { Brand, GeneratedAsset, QoollineCampaign, QoollineGenerationResult, PipelineImage } from '../types';
import { generateBrandedImage, reviseGeneratedImage, adaptMasterToFormat, analyzeImageStyle } from '../services/geminiService';
import { QOOLLINE_CAMPAIGNS, QOOLLINE_COUNTRIES, qoollineQualityCheck, generateCountryPrompt } from '../services/qoollineService';
import { downloadBase64Image, downloadMultipleImages } from '../services/downloadService';
import CampaignFactory from './qoolline/CampaignFactory';
import CopywritingPanel from './qoolline/CopywritingPanel';
import CountryThemes from './qoolline/CountryThemes';
import QoollineResults from './qoolline/QoollineResults';

type QoollineTab = 'campaigns' | 'copy' | 'countries';

interface QoollineHubProps {
  brand: Brand;
  addToHistory: (asset: GeneratedAsset) => void;
}

const QoollineHub: React.FC<QoollineHubProps> = ({ brand, addToHistory }) => {
  const [activeTab, setActiveTab] = useState<QoollineTab>('campaigns');
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<QoollineGenerationResult[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  // Country themes state
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [countryCampaignId, setCountryCampaignId] = useState(QOOLLINE_CAMPAIGNS[0].id);

  const log = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('tr-TR');
    setLogs(prev => [...prev, `[${time}] ${msg}`]);
  }, []);

  const updateResult = useCallback((id: string, updates: Partial<QoollineGenerationResult>) => {
    setResults(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, []);

  // ═══ CAMPAIGN GENERATION ═══
  const handleStartGeneration = useCallback(async (
    campaigns: QoollineCampaign[],
    formats: string[],
    referenceImages: PipelineImage[]
  ) => {
    setIsRunning(true);
    setLogs([]);

    // Initialize results
    const initialResults: QoollineGenerationResult[] = [];
    campaigns.forEach(campaign => {
      formats.forEach(fmt => {
        initialResults.push({
          id: `${campaign.id}-${fmt}-${Date.now()}`,
          campaignId: campaign.id,
          campaignType: campaign.type,
          topic: `[${campaign.type}] ${campaign.core} | ${campaign.supporting} | CTA: ${campaign.cta} | ${campaign.extra}`,
          format: fmt,
          status: 'pending',
          qcRetryCount: 0,
        });
      });
    });
    setResults(initialResults);

    log(`Pipeline baslatildi: ${campaigns.length} kampanya x ${formats.length} format = ${initialResults.length} gorsel`);

    // Analyze reference style if provided
    let refStyleAnalysis = null;
    if (referenceImages.length > 0) {
      log('Referans stil analiz ediliyor...');
      try {
        refStyleAnalysis = await analyzeImageStyle(referenceImages[0].base64);
        log(`Stil analizi tamamlandi: ${refStyleAnalysis.mood}, ${refStyleAnalysis.artisticStyle}`);
      } catch (err: any) {
        log(`Stil analizi hatasi: ${err.message}`);
      }
    }

    const masterFormat = formats[0];
    const adaptFormats = formats.slice(1);

    for (const campaign of campaigns) {
      const masterResultId = initialResults.find(r => r.campaignId === campaign.id && r.format === masterFormat)?.id;
      if (!masterResultId) continue;

      // ─── Generate Master ───
      updateResult(masterResultId, { status: 'generating' });
      log(`Uretiliyor: "${campaign.type}" [${masterFormat}]`);

      let masterImage: string | null = null;
      const prompt = `Create a professional social media banner for Qoolline (eSIM brand).

CAMPAIGN: ${campaign.type}
HEADLINE: "${campaign.core}"
SUPPORTING TEXT: "${campaign.supporting}"
CTA BUTTON: "${campaign.cta}"
ADDITIONAL: "${campaign.extra}"
CREATIVE NOTES: ${campaign.notes}

BRAND RULES:
- Brand Yellow #F8BE00 as primary, Brand Black #201C1D as secondary
- Purple accent #6B63FF, Green CTA accent #00CC9B
- CTA must be a BUTTON (rounded rectangle), not plain text
- Single clear message, no competing messages
- Logo must be high contrast, never on gradients
- Mobile-first readability, short text blocks
- Show Qoolline app UI or phone with app
- Professional quality, no AI artifacts
- No decorative clutter (dots, waves, abstract shapes)

Aspect ratio: ${masterFormat}
Generate a polished, ready-to-publish banner.`;

      try {
        if (refStyleAnalysis && referenceImages.length > 0) {
          masterImage = await generateBrandedImage(
            brand, refStyleAnalysis, referenceImages[0].base64, null,
            prompt, masterFormat
          );
        } else {
          masterImage = await generateBrandedImage(
            brand,
            { composition: 'centered', lighting: 'studio', colorPaletteDescription: 'yellow and black', mood: 'professional', textureDetails: 'clean', cameraAngle: 'front', artisticStyle: 'modern banner', backgroundDetails: 'gradient' },
            '', null, prompt, masterFormat
          );
        }
        log(`  Master uretildi.`);
      } catch (err: any) {
        updateResult(masterResultId, { status: 'failed', error: err.message });
        log(`  Master hatasi: ${err.message}`);
        // Skip adaptations
        adaptFormats.forEach(fmt => {
          const adaptId = initialResults.find(r => r.campaignId === campaign.id && r.format === fmt)?.id;
          if (adaptId) updateResult(adaptId, { status: 'failed', error: 'Master uretilemedi' });
        });
        continue;
      }

      // ─── Inline QC ───
      const MAX_RETRIES = 2;
      let qcRetryCount = 0;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        updateResult(masterResultId, { status: 'qc-checking', imageBase64: masterImage! });
        log(`  QC kontrol ${attempt > 0 ? `(retry ${attempt})` : ''}...`);

        try {
          const qcResult = await qoollineQualityCheck(masterImage!, campaign.type, campaign.notes);
          log(`  QC Puan: ${qcResult.score}/10 ${qcResult.passed ? '✓ GECTI' : '✗ KALDI'}`);
          if (qcResult.issues.length > 0) log(`  Sorunlar: ${qcResult.issues.join(', ')}`);

          if (qcResult.passed) {
            updateResult(masterResultId, { status: 'completed', imageBase64: masterImage!, qc: qcResult, qcRetryCount });
            break;
          }

          if (attempt < MAX_RETRIES && qcResult.revisionInstruction) {
            qcRetryCount = attempt + 1;
            updateResult(masterResultId, { status: 'revising' });
            log(`  Revizyon baslatiyor (${qcRetryCount}/${MAX_RETRIES})...`);
            try {
              masterImage = await reviseGeneratedImage(masterImage!, qcResult.revisionInstruction, null);
              log(`  Revize edildi, tekrar kontrol ediliyor...`);
            } catch {
              log(`  Revizyon hatasi, mevcut gorsel korunuyor.`);
              updateResult(masterResultId, { status: 'completed', imageBase64: masterImage!, qc: qcResult, qcRetryCount });
              break;
            }
          } else {
            log(`  ${MAX_RETRIES} retry sonrasi hala dusuk kalite.`);
            updateResult(masterResultId, { status: 'completed', imageBase64: masterImage!, qc: qcResult, qcRetryCount });
          }
        } catch (qcErr: any) {
          log(`  QC hatasi: ${qcErr.message}, QC atlaniyor.`);
          updateResult(masterResultId, { status: 'completed', imageBase64: masterImage! });
          break;
        }
      }

      // ─── Adapt to other formats ───
      for (const fmt of adaptFormats) {
        const adaptId = initialResults.find(r => r.campaignId === campaign.id && r.format === fmt)?.id;
        if (!adaptId || !masterImage) continue;

        updateResult(adaptId, { status: 'generating' });
        log(`  Adapt ediliyor: [${masterFormat} -> ${fmt}]`);

        try {
          const adapted = await adaptMasterToFormat(
            masterImage,
            { canvas: { aspectRatio: masterFormat, backgroundColor: brand.primaryColor, mood: 'professional', style: 'banner' }, layout: { type: 'single-column', alignment: 'center', padding: '5%', gutterSize: '2%', visualFlow: '' }, layers: [], typography: { headingStyle: '', bodyStyle: '', accentStyle: '', hierarchy: '' }, colorSystem: { dominant: brand.primaryColor, secondary: brand.secondaryColor, accent: '#6B63FF', textPrimary: '#FFFFFF', textSecondary: '#CCCCCC', distribution: '' }, compositionNotes: '', formatAdjustments: {} },
            brand, campaign.core, fmt, masterFormat, null
          );
          updateResult(adaptId, { status: 'completed', imageBase64: adapted });
          log(`  ✓ Adaptasyon tamamlandi [${fmt}]`);
        } catch (err: any) {
          updateResult(adaptId, { status: 'failed', error: err.message });
          log(`  ✗ Adaptasyon hatasi [${fmt}]: ${err.message}`);
        }
      }
    }

    log('Pipeline tamamlandi!');
    setIsRunning(false);
  }, [brand, log, updateResult]);

  // ═══ COUNTRY GENERATION ═══
  const handleStartCountryGeneration = useCallback(async () => {
    if (selectedCountries.size === 0) return;
    const campaign = QOOLLINE_CAMPAIGNS.find(c => c.id === countryCampaignId)!;
    const countries = QOOLLINE_COUNTRIES.filter(c => selectedCountries.has(c.id));

    setIsRunning(true);
    setLogs([]);

    const initialResults: QoollineGenerationResult[] = [];
    countries.forEach(country => {
      initialResults.push({
        id: `country-${country.id}-${Date.now()}`,
        campaignId: campaign.id,
        campaignType: `${campaign.type} — ${country.emoji} ${country.country}`,
        topic: `${country.localizedMessage} (${campaign.core})`,
        format: '4:5',
        status: 'pending',
        qcRetryCount: 0,
      });
    });
    setResults(initialResults);

    log(`Ulke temali uretim: ${countries.length} ulke, kampanya: ${campaign.type}`);

    for (let i = 0; i < countries.length; i++) {
      const country = countries[i];
      const resultId = initialResults[i].id;

      updateResult(resultId, { status: 'generating' });
      log(`Uretiliyor: ${country.emoji} ${country.country}...`);

      try {
        const prompt = await generateCountryPrompt(country, campaign, brand);
        log(`  Prompt olusturuldu, gorsel uretiliyor...`);

        const image = await generateBrandedImage(
          brand,
          { composition: 'centered', lighting: 'natural', colorPaletteDescription: 'yellow and black', mood: 'travel', textureDetails: 'clean', cameraAngle: 'front', artisticStyle: 'modern travel ad', backgroundDetails: country.visualKeywords.join(', ') },
          '', null, prompt, '4:5'
        );

        updateResult(resultId, { status: 'completed', imageBase64: image });
        log(`  ✓ ${country.country} tamamlandi`);
      } catch (err: any) {
        updateResult(resultId, { status: 'failed', error: err.message });
        log(`  ✗ ${country.country} hatasi: ${err.message}`);
      }
    }

    log('Ulke temali uretim tamamlandi!');
    setIsRunning(false);
  }, [brand, selectedCountries, countryCampaignId, log, updateResult]);

  // ═══ REVISION HANDLER ═══
  const handleRevise = useCallback(async (resultId: string, instruction: string) => {
    const result = results.find(r => r.id === resultId);
    if (!result) return;
    const sourceImage = result.revisedImageBase64 || result.imageBase64;
    if (!sourceImage) return;

    try {
      const revised = await reviseGeneratedImage(sourceImage, instruction, null);
      setResults(prev => prev.map(r => r.id === resultId ? { ...r, revisedImageBase64: revised } : r));
    } catch (err: any) {
      console.error('Revision failed:', err);
    }
  }, [results]);

  const handleDownloadAll = () => {
    const items = results
      .filter(r => r.imageBase64 || r.revisedImageBase64)
      .map(r => ({
        base64: (r.revisedImageBase64 || r.imageBase64)!,
        filename: `qoolline-${r.campaignType.replace(/[^a-zA-Z0-9]/g, '-')}-${r.format}.png`
      }));
    downloadMultipleImages(items);
  };

  const tabs = [
    { id: 'campaigns' as QoollineTab, label: 'Kampanya', icon: Zap },
    { id: 'copy' as QoollineTab, label: 'Kopya', icon: Sparkles },
    { id: 'countries' as QoollineTab, label: 'Ulkeler', icon: Globe },
  ];

  return (
    <div className="p-4 lg:p-6 h-screen overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-serif text-white flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#F8BE00]/20 flex items-center justify-center">
              <Zap size={18} className="text-[#F8BE00]" />
            </div>
            Qoolline Hub
          </h2>
          <p className="text-sm text-slate-400 mt-1">Kampanya fabrikasi, kalite kontrol ve icerik uretimi</p>
        </div>
        {results.some(r => r.imageBase64) && (
          <button onClick={handleDownloadAll} className="flex items-center gap-2 px-4 py-2 bg-lumina-900 border border-lumina-800 rounded-lg text-xs text-white hover:bg-lumina-800 transition-all">
            <Download size={14} /> Tumunu Indir
          </button>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left Panel — Config */}
        <div className="col-span-12 lg:col-span-4">
          <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-4">
            {/* Tabs */}
            <div className="flex gap-1 mb-5 bg-lumina-950 rounded-lg p-1">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${isActive ? 'bg-lumina-gold/10 text-lumina-gold' : 'text-slate-500 hover:text-white'}`}>
                    <Icon size={12} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            {activeTab === 'campaigns' && (
              <CampaignFactory brand={brand} onStartGeneration={handleStartGeneration} isRunning={isRunning} />
            )}
            {activeTab === 'copy' && (
              <CopywritingPanel />
            )}
            {activeTab === 'countries' && (
              <div className="space-y-4">
                <CountryThemes
                  selectedCountries={selectedCountries}
                  onToggleCountry={(id) => setSelectedCountries(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
                  selectedCampaignId={countryCampaignId}
                  onCampaignChange={setCountryCampaignId}
                />
                <button onClick={handleStartCountryGeneration} disabled={isRunning || selectedCountries.size === 0} className="w-full py-3 bg-[#F8BE00] text-[#201C1D] rounded-xl font-bold text-sm hover:bg-[#F8BE00]/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Globe size={16} />}
                  {isRunning ? 'Uretiliyor...' : `${selectedCountries.size} Ulke Icin Uret`}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel — Results */}
        <div className="col-span-12 lg:col-span-8">
          {results.length > 0 ? (
            <QoollineResults results={results} onRevise={handleRevise} logs={logs} />
          ) : (
            <div className="bg-lumina-900 border border-lumina-800 rounded-xl p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#F8BE00]/10 flex items-center justify-center">
                <Zap size={28} className="text-[#F8BE00]" />
              </div>
              <h3 className="text-lg font-serif text-white mb-2">Qoolline Kampanya Motoru</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                Soldaki panelden kampanya sablonlarini sec, boyutlari belirle ve uretimi baslat. Her gorsel 13 kurala gore otomatik kalite kontrolden gecer.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QoollineHub;
