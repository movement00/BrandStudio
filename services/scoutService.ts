import { ScoutResult, ScoutInspiration, Brand, StyleAnalysis } from '../types';
import { analyzeImageStyle, generateBrandedImage } from './geminiService';

const SUPABASE_URL = 'https://yvsvxurquhtzaeuszwtb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2c3Z4dXJxdWh0emFldXN6d3RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzNDE2MjAsImV4cCI6MjA4OTkxNzYyMH0.7xSR9mazaNDOmsTbotldB_yO3utM_UlDHyglOzmF1nI';

const EDGE_FN_URL = `${SUPABASE_URL}/functions/v1/content-scout`;

// Supabase REST API helper
async function supabaseRest(table: string, method: string, body?: any, query?: string) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ''}`;
  const headers: Record<string, string> = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
  };

  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Supabase error: ${resp.status} ${text}`);
  }

  const contentType = resp.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return resp.json();
  }
  return null;
}

// Search for inspiration images
export async function searchInspiration(
  query: string,
  sources: string[] = ['pexels', 'pinterest', 'web'],
  industry?: string
): Promise<{ results: ScoutResult[]; sourcesUsed: { pexels: boolean; google: boolean } }> {
  try {
    const resp = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'search', query, sources, industry }),
    });

    if (!resp.ok) throw new Error(`Search failed: ${resp.status}`);
    const data = await resp.json();

    return {
      results: (data.results || []).map((r: any, i: number) => ({
        ...r,
        id: `scout-${Date.now()}-${i}`,
      })),
      sourcesUsed: data.sources_used || { pexels: false, google: false },
    };
  } catch (err) {
    console.error('Scout search error:', err);
    return { results: [], sourcesUsed: { pexels: false, google: false } };
  }
}

// Download an image via proxy (CORS bypass)
export async function downloadImage(imageUrl: string): Promise<{ base64: string; mimeType: string }> {
  const resp = await fetch(EDGE_FN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'proxy', url: imageUrl }),
  });

  if (!resp.ok) throw new Error(`Proxy failed: ${resp.status}`);
  return resp.json();
}

// Full scout pipeline: search → download → analyze → adapt → save
export async function scoutAndAdapt(
  imageBase64: string,
  brand: Brand,
  topic: string,
  aspectRatio: string = '1:1',
  onProgress?: (step: string, progress: number) => void
): Promise<{ analysis: StyleAnalysis; adaptedImage: string }> {
  // Step 1: Analyze style
  onProgress?.('Stil analiz ediliyor...', 20);
  const analysis = await analyzeImageStyle(imageBase64);

  // Step 2: Generate adapted image
  onProgress?.('Marka uyarlaması yapılıyor...', 60);
  const adaptedImage = await generateBrandedImage(
    analysis,
    brand,
    topic,
    aspectRatio,
    imageBase64,
    undefined, // productImage
    undefined  // logoBase64
  );

  onProgress?.('Tamamlandı!', 100);
  return { analysis, adaptedImage };
}

// Save inspiration to Supabase
export async function saveInspiration(data: {
  brandId: string;
  searchQuery: string;
  sourceUrl?: string;
  sourcePlatform: string;
  originalImageBase64?: string;
  adaptedImageBase64?: string;
  styleAnalysis?: StyleAnalysis;
  status: string;
  tags?: string[];
  score?: number;
}): Promise<ScoutInspiration> {
  const result = await supabaseRest('scout_inspirations', 'POST', {
    brand_id: data.brandId,
    search_query: data.searchQuery,
    source_url: data.sourceUrl,
    source_platform: data.sourcePlatform,
    original_image_base64: data.originalImageBase64,
    adapted_image_base64: data.adaptedImageBase64,
    style_analysis: data.styleAnalysis,
    status: data.status,
    tags: data.tags || [],
    score: data.score || 0,
  });

  return mapDbToInspiration(result[0]);
}

// Load saved inspirations from Supabase
export async function loadInspirations(brandId?: string, status?: string): Promise<ScoutInspiration[]> {
  let query = 'order=created_at.desc&limit=50';
  if (brandId) query += `&brand_id=eq.${brandId}`;
  if (status) query += `&status=eq.${status}`;

  const data = await supabaseRest('scout_inspirations', 'GET', undefined, query);
  return (data || []).map(mapDbToInspiration);
}

// Update inspiration status
export async function updateInspirationStatus(id: string, status: string, updates?: Record<string, any>) {
  const body: any = { status };
  if (updates?.adapted_image_base64) body.adapted_image_base64 = updates.adapted_image_base64;
  if (updates?.style_analysis) body.style_analysis = updates.style_analysis;
  body.updated_at = new Date().toISOString();

  await supabaseRest('scout_inspirations', 'PATCH', body, `id=eq.${id}`);
}

// Delete inspiration
export async function deleteInspiration(id: string) {
  await supabaseRest('scout_inspirations', 'DELETE', undefined, `id=eq.${id}`);
}

// Check edge function health
export async function checkScoutHealth(): Promise<{ status: string; sources: { pexels: boolean; google_cse: boolean } }> {
  try {
    const resp = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'health' }),
    });
    return resp.json();
  } catch {
    return { status: 'error', sources: { pexels: false, google_cse: false } };
  }
}

// Helper: map DB row to ScoutInspiration
function mapDbToInspiration(row: any): ScoutInspiration {
  return {
    id: row.id,
    brandId: row.brand_id,
    searchQuery: row.search_query,
    sourceUrl: row.source_url,
    sourcePlatform: row.source_platform,
    originalImageBase64: row.original_image_base64,
    adaptedImageBase64: row.adapted_image_base64,
    styleAnalysis: row.style_analysis,
    status: row.status,
    tags: row.tags || [],
    score: row.score || 0,
    createdAt: row.created_at,
  };
}

// Generate smart search queries based on brand
export function generateSearchQueries(brand: Brand): string[] {
  const industryMap: Record<string, string[]> = {
    'Telekomünikasyon': ['tech social media design', 'mobile app promotion post', 'esim travel design', 'telecom marketing visual'],
    'Eğitim': ['education social media post', 'school marketing design', 'student motivation poster', 'academic achievement design'],
    'Okul Öncesi': ['preschool social media', 'kindergarten colorful design', 'child education poster', 'playful school marketing'],
    'Tesettür': ['hijab fashion social media', 'modest fashion post design', 'scarf collection promotion', 'elegant fashion marketing'],
    'İç Mimarlık': ['interior design social media', 'minimalist home design post', 'architecture marketing visual', 'luxury home promotion'],
    'Sınava Hazırlık': ['education motivation post', 'exam preparation design', 'student success social media', 'tutoring center marketing'],
  };

  // Find matching industry keywords
  const queries: string[] = [];
  for (const [key, values] of Object.entries(industryMap)) {
    if (brand.industry.toLowerCase().includes(key.toLowerCase())) {
      queries.push(...values);
      break;
    }
  }

  // Add generic queries if no match
  if (queries.length === 0) {
    queries.push(
      `${brand.industry} social media post design`,
      `${brand.industry} marketing visual`,
      `professional ${brand.industry} promotion design`
    );
  }

  return queries;
}
