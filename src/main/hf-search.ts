const HF_API_BASE = 'https://huggingface.co/api';
const PREFERRED_QUANTS = ['Q4_K_M', 'Q4_K_S', 'Q5_K_M', 'Q5_K_S', 'Q4_0', 'Q8_0'];

export interface HfModelResult {
  id: string;
  hfId: string;
  name: string;
  author: string;
  size: number;
  memoryRequired: number;
  quantization: string;
  license: string;
  licenseUrl: string;
  commercial: boolean;
  downloadUrl: string;
  tags: string[];
  description: string;
  downloads: number;
  likes: number;
  lastModified: string;
  source: 'huggingface';
}

export interface HfSearchOptions {
  search?: string;
  sort?: 'downloads' | 'likes' | 'trending' | 'lastModified';
  limit?: number;
  commercialOnly?: boolean;
  author?: string;
  hfToken?: string;
}

function extractQuantization(filename: string): string | null {
  const match = filename.match(/[\-_](Q\d[\w]+|IQ\d[\w]+|BF16|F16|F32)/i);
  return match ? match[1].toUpperCase() : null;
}

function selectBestGgufFile(siblings: any[]): { filename: string; quantization: string } | null {
  if (!siblings?.length) return null;
  const ggufFiles = siblings
    .map((s: any) => s.rfilename as string)
    .filter((f) => f.endsWith('.gguf') && !f.includes('/') && !f.startsWith('mmproj'));
  if (ggufFiles.length === 0) return null;

  for (const quant of PREFERRED_QUANTS) {
    const found = ggufFiles.find((f) => f.toUpperCase().includes(quant));
    if (found) return { filename: found, quantization: quant };
  }
  const first = ggufFiles[0];
  return { filename: first, quantization: extractQuantization(first) || 'UNKNOWN' };
}

const COMMERCIAL_LICENSES = [
  'apache-2.0', 'mit', 'bsd-2-clause', 'bsd-3-clause',
  'cc-by-4.0', 'cc-by-sa-4.0', 'openrail', 'openrail++',
  'llama3', 'gemma', 'cc0-1.0', 'wtfpl', 'unlicense',
];
const LICENSE_NAMES: Record<string, string> = {
  'apache-2.0': 'Apache 2.0', 'mit': 'MIT', 'bsd-2-clause': 'BSD 2-Clause',
  'bsd-3-clause': 'BSD 3-Clause', 'cc-by-4.0': 'CC BY 4.0', 'cc-by-sa-4.0': 'CC BY-SA 4.0',
  'openrail': 'OpenRAIL', 'openrail++': 'OpenRAIL++', 'llama3': 'Llama 3 Community License',
  'llama3.1': 'Llama 3.1 Community License', 'llama3.2': 'Llama 3.2 Community License',
  'gemma': 'Gemma License', 'cc0-1.0': 'CC0 1.0', 'other': 'Other',
};
const LICENSE_URLS: Record<string, string> = {
  'apache-2.0': 'https://choosealicense.com/licenses/apache-2.0/',
  'mit': 'https://choosealicense.com/licenses/mit/',
  'gemma': 'https://ai.google.dev/gemma/terms',
};

function parseLicenseFromTags(tags: string[]) {
  const licenseTag = (tags || []).find((t) => t.startsWith('license:'));
  if (!licenseTag) return { license: 'Unknown', commercial: false, licenseUrl: '' };
  const licenseId = licenseTag.replace('license:', '');
  const commercial = COMMERCIAL_LICENSES.some((l) => licenseId.toLowerCase().includes(l));
  const license = LICENSE_NAMES[licenseId] || licenseId.toUpperCase();
  const licenseUrl = LICENSE_URLS[licenseId] || `https://huggingface.co/models?license=${licenseId}`;
  return { license, commercial, licenseUrl };
}

function convertHfModelToAppModel(hfModel: any): HfModelResult | null {
  const bestFile = selectBestGgufFile(hfModel.siblings);
  if (!bestFile) return null;
  const { license, commercial, licenseUrl } = parseLicenseFromTags(hfModel.tags || []);
  const downloadUrl = `https://huggingface.co/${hfModel.id}/resolve/main/${bestFile.filename}`;
  const tagStr = (hfModel.tags || []).join(' ').toLowerCase();
  const appTags: string[] = [];
  if (tagStr.includes('instruct') || tagStr.includes('chat')) appTags.push('instruct');
  if (tagStr.includes('code') || tagStr.includes('coder')) appTags.push('code');
  if (tagStr.includes('japanese') || tagStr.includes('ja')) appTags.push('japanese');
  if (tagStr.includes('multilingual')) appTags.push('multilingual');
  if (tagStr.includes('reasoning') || tagStr.includes('thinking')) appTags.push('reasoning');
  if (tagStr.includes('vision') || tagStr.includes('image-text')) appTags.push('vision');
  if (tagStr.includes('moe') || tagStr.includes('mixture')) appTags.push('moe');

  return {
    id: hfModel.id.replace('/', '_').toLowerCase(),
    hfId: hfModel.id,
    name: hfModel.id.split('/').pop(),
    author: hfModel.author || hfModel.id.split('/')[0],
    size: 0,
    memoryRequired: 0,
    quantization: bestFile.quantization,
    license, licenseUrl, commercial, downloadUrl,
    tags: appTags,
    description: `${hfModel.id} — ダウンロード数: ${(hfModel.downloads || 0).toLocaleString()}, Likes: ${(hfModel.likes || 0).toLocaleString()}`,
    downloads: hfModel.downloads || 0,
    likes: hfModel.likes || 0,
    lastModified: hfModel.lastModified,
    source: 'huggingface',
  };
}

export async function searchHuggingFaceModels(options: HfSearchOptions = {}): Promise<HfModelResult[]> {
  const { search = '', sort = 'downloads', limit = 30, author = '', hfToken = '', commercialOnly } = options;
  const fetchLimit = Math.min(limit * 3, 100);

  const url = new URL(`${HF_API_BASE}/models`);
  url.searchParams.set('sort', sort);
  url.searchParams.set('limit', String(fetchLimit));
  url.searchParams.set('full', 'true');
  url.searchParams.set('search', search ? `${search} GGUF` : 'GGUF');
  if (author) url.searchParams.set('author', author);

  const headers: Record<string, string> = { Accept: 'application/json', 'User-Agent': 'aozora/1.0' };
  if (hfToken) headers['Authorization'] = `Bearer ${hfToken}`;

  const response = await fetch(url.toString(), { headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HuggingFace API error ${response.status}: ${text}`);
  }

  const hfModels = await response.json() as any[];
  let converted = hfModels.map(convertHfModelToAppModel).filter((m): m is HfModelResult => m !== null).slice(0, limit);
  if (commercialOnly === true) converted = converted.filter((m) => m.commercial);
  return converted;
}
