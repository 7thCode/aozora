import * as fs from 'fs/promises';
import * as path from 'path';

const esmImport = new Function('modulePath', 'return import(modulePath)') as
  (modulePath: string) => Promise<any>;

export interface LocalModel {
  id: string;
  name: string;
  path: string;
  size: number;
  sizeFormatted: string;
  createdAt: Date;
  isVision: boolean;
  mmprojPath: string | null;
}

const VISION_NAME_PATTERNS = [
  /llava/i, /moondream/i, /minicpm[\-_]?v/i, /qwen[\-_]?vl/i,
  /internvl/i, /phi[\-_]?v\b/i, /vision/i, /multimodal/i,
  /cogvlm/i, /idefics/i, /bakllava/i,
];
const MMPROJ_NAME_PATTERNS = [/mmproj/i, /\bclip\b/i];

export class ModelManager {
  private modelsDir: string;

  constructor(modelsDir: string) {
    this.modelsDir = modelsDir;
  }

  setModelsDirectory(newDir: string): void {
    this.modelsDir = newDir;
  }

  getModelsDirectory(): string {
    return this.modelsDir;
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.modelsDir, { recursive: true });
  }

  async listModels(): Promise<LocalModel[]> {
    try {
      const files = await fs.readdir(this.modelsDir);
      const models: LocalModel[] = [];

      for (const file of files) {
        if (!file.endsWith('.gguf')) continue;
        const filePath = path.join(this.modelsDir, file);
        const stats = await fs.stat(filePath);
        const vision = await this.detectVisionCapability(filePath);
        if (vision.isMmproj) continue;

        models.push({
          id: file,
          name: file.replace('.gguf', ''),
          path: filePath,
          size: stats.size,
          sizeFormatted: this.formatBytes(stats.size),
          createdAt: stats.birthtime,
          isVision: vision.isVision,
          mmprojPath: vision.mmprojPath,
        });
      }

      models.sort((a, b) => a.name.localeCompare(b.name));
      return models;
    } catch {
      return [];
    }
  }

  async detectVisionCapability(modelPath: string): Promise<{
    isVision: boolean;
    isMmproj: boolean;
    mmprojPath: string | null;
  }> {
    const basename = path.basename(modelPath, '.gguf');

    if (MMPROJ_NAME_PATTERNS.some((p) => p.test(basename))) {
      return { isVision: false, isMmproj: true, mmprojPath: null };
    }

    try {
      const { readGgufFileInfo } = await esmImport('node-llama-cpp');
      const info = await readGgufFileInfo(modelPath, { readTensorInfo: false });
      if (info?.metadata?.general?.architecture === 'clip') {
        return { isVision: false, isMmproj: true, mmprojPath: null };
      }
    } catch {
      // 名前ベースで判定へ
    }

    const nameIndicatesVision = VISION_NAME_PATTERNS.some((p) => p.test(basename));
    const mmprojPath = await this.findMmprojForModel(modelPath);

    return {
      isVision: nameIndicatesVision || mmprojPath !== null,
      isMmproj: false,
      mmprojPath,
    };
  }

  async findMmprojForModel(modelPath: string): Promise<string | null> {
    const dir = path.dirname(modelPath);
    const basename = path.basename(modelPath, '.gguf').toLowerCase();
    const self = path.basename(modelPath);

    try {
      const files = await fs.readdir(dir);
      const ggufFiles = files.filter((f) => f.endsWith('.gguf') && f !== self);

      let candidates = ggufFiles.filter(
        (f) => MMPROJ_NAME_PATTERNS.some((p) => p.test(f))
      );

      if (candidates.length === 0) {
        try {
          const { readGgufFileInfo } = await esmImport('node-llama-cpp');
          for (const f of ggufFiles) {
            try {
              const info = await readGgufFileInfo(path.join(dir, f), { readTensorInfo: false });
              if (info?.metadata?.general?.architecture === 'clip') candidates.push(f);
            } catch { /* skip */ }
          }
        } catch { /* skip */ }
      }

      if (candidates.length === 0) return null;
      if (candidates.length === 1) return path.join(dir, candidates[0]);

      const modelBase = basename.replace(/[-_]q\d.*$/i, '');
      const matched = candidates.find((f) => {
        const n = f.toLowerCase().replace('.gguf', '').replace(/[-_]mmproj.*$/, '');
        return n === modelBase || n.includes(modelBase) || modelBase.includes(n);
      });

      return path.join(dir, matched || candidates[0]);
    } catch {
      return null;
    }
  }

  async deleteModel(modelId: string): Promise<void> {
    const modelPath = path.join(this.modelsDir, modelId);
    await fs.unlink(modelPath);
  }

  async modelExists(modelId: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.modelsDir, modelId));
      return true;
    } catch {
      return false;
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}
