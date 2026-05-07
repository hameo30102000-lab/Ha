export interface ABScriptVariant {
  angle: string;          // Góc độ tiếp cận (VD: Xoáy vào nỗi đau, Bắt trend TikTok, Hoạt cảnh hài hước)
  hookText: string;       // Câu Hook 3 giây đầu (Gây ấn tượng, tò mò)
  visualAction: string;   // Hành động 3 giây đầu để giữ chân người xem
  script: string;         // Kịch bản chi tiết
  audioBPM: string;       // Gợi ý nhạc (VD: "Fast BPM 120+, Phonics Bass", "Lo-fi chill 80 BPM")
  viralScore: number;     // Chấm điểm tiềm năng Viral (0-100)
}

export interface StoryboardShot {
  shotType: string;       // VD: Close-up, Wide Shot, Macro
  cameraMove: string;     // VD: Static Tripod, Slow Dolly-In, Whip Pan
  durationSec: number;    // Thời lượng cảnh (1-5s)
  prompt: string;         // Tiếng Anh (Cho Sora/Veo)
  descriptionLine: string;// Tiếng Việt
}

export interface ProductResult {
  analysis: {
    category: string;
    coreFunction: string;
    targetAudience: string;
    naturalContext: string;
    sentimentAnalysis?: string;
    detailedDescription?: string;
  };
  imagePrompt: string;
  videoPrompts?: string[];
  videoDescriptions?: string[];
  tiktokScript?: string;
  tiktokCaption?: string;
  
  // Nâng cấp: Ý tưởng 3 & 4
  abScripts?: ABScriptVariant[];
  storyboard?: StoryboardShot[];
}

export interface ProductItem {
  id: string;
  image: string; // base64
  modelImage?: string; // base64 - the specific model image used for this item
  combinedImage?: string; // base64 - image uploaded after Phase 1
  description?: string;
  userReviews?: string;
  descriptionImage?: string; // base64 - image for AI to read details
  status: 'idle' | 'processing_phase1' | 'ready_for_combined' | 'processing_phase2' | 'done' | 'error';
  result?: ProductResult;
  history?: {
    id: string;
    timestamp: number;
    result: ProductResult;
    actionType: string;
  }[];
  error?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface AppState {
  modelImages: string[];
  products: ProductItem[];
  selectedProductId: string | null;
  viewMode: 'grid' | 'list';
  fixedHashtags?: string;
}
