/// <reference types="vite/client" />
import { GoogleGenAI, Type, Part } from "@google/genai";
import { ProductResult } from "../types";

export function getInlineData(base64String: string) {
    if (!base64String) throw new Error("Image data is empty");
    const match = base64String.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (match) {
        return { inlineData: { mimeType: match[1], data: match[2] } };
    }
    // Fallback nếu chuỗi không có phần tiền tố chuẩn
    const parts = base64String.split(',');
    return { inlineData: { mimeType: "image/jpeg", data: parts[1] || parts[0] } };
}

function safeJsonParse(text: string): any {
    if (!text || text.trim() === "") {
        console.error("Gemini AI returned empty text.");
        throw new Error("AI trả về dữ liệu trống. Vui lòng thử lại.");
    }
    
    try {
        return JSON.parse(text);
    } catch (e1) {
        console.warn("Direct JSON.parse failed, attempting to clean text...", e1);
        let cleanText = text.replace(/```(?:json)?\n?/i, '').replace(/```\n?$/, '').trim();
        try {
            return JSON.parse(cleanText);
        } catch (e2) {
            console.warn("JSON.parse after markdown cleanup failed, extracting with regex...", e2);
            // Non-greedy match for object or array
            const match = cleanText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
            if (!match) {
                console.error("No JSON structure found in output:\n", text);
                throw new Error("AI trả về dữ liệu sai định dạng. Vui lòng thử lại.");
            }
            try {
                // Remove some common control characters that break JSON
                let extracted = match[0]
                  .replace(/[\u0000-\u001F]+/g, (m) => m === '\n' || m === '\r' || m === '\t' ? m : '');
                
                return JSON.parse(extracted);
            } catch (e3) {
                console.error("Failed to parse extracted JSON. Extracted string:\n", match[0], "\nParse Error:", e3);
                throw new Error("AI trả về dữ liệu sai định dạng. Vui lòng thử lại.");
            }
        }
    }
}

function enforceScriptLength(text: string): string {
    if (!text) return text;
    if (text.length <= 420) return text;
    
    let truncated = text.slice(0, 415);
    const lastPunc = Math.max(truncated.lastIndexOf('.'), truncated.lastIndexOf('!'), truncated.lastIndexOf('?'));
    if (lastPunc > 200) {
        return truncated.slice(0, lastPunc + 1);
    }
    const lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace > 200) {
        return truncated.slice(0, lastSpace) + "...";
    }
    return truncated + "...";
}

function enforceResultLengths(result: any): any {
    if (!result) return result;
    if (typeof result.tiktokScript === 'string') {
        result.tiktokScript = enforceScriptLength(result.tiktokScript);
    }
    if (Array.isArray(result.abScripts)) {
        result.abScripts.forEach((ab: any) => {
            if (typeof ab.script === 'string') {
                ab.script = enforceScriptLength(ab.script);
            }
        });
    }
    return result;
}

// Hàm hỗ trợ gọi API Gemini với cơ chế thử lại (retry) và dịch lỗi sang tiếng Việt
async function generateContentWithRetry(ai: GoogleGenAI, requestParam: any, maxRetries = 3) {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await ai.models.generateContent(requestParam);
        } catch (error: any) {
            lastError = error;
            console.error(`Lỗi API Gemini (Lần thử ${i + 1}/${maxRetries}):`, error);
            
            const errMessage = error?.message || String(error);
            
            // Check for 429 Quota Exceeded
            if (error?.status === 429 || errMessage.includes("429") || errMessage.includes("Quota")) {
                const waitTime = Math.pow(2, i) * 1500;
                console.log(`Vượt quá giới hạn (429). Đang thử lại sau ${waitTime}ms...`);
                await new Promise(res => setTimeout(res, waitTime));
                continue;
            }
            
            // Check for 503 Service Unavailable
            if (error?.status === 503 || errMessage.includes("503") || errMessage.includes("overloaded")) {
                const waitTime = Math.pow(2, i) * 2000;
                console.log(`Dịch vụ quá tải (503). Đang thử lại sau ${waitTime}ms...`);
                await new Promise(res => setTimeout(res, waitTime));
                continue;
            }

            // Check for transient network issues
            if (errMessage.includes("network") || errMessage.includes("fetch") || errMessage.includes("ECONNRESET")) {
                const waitTime = Math.pow(2, i) * 1000;
                console.log(`Lỗi mạng. Đang thử lại sau ${waitTime}ms...`);
                await new Promise(res => setTimeout(res, waitTime));
                continue;
            }

            // Other errors (e.g. 400 Bad Request, Safety blocks) should fail immediately
            break;
        }
    }
    
    // Process and translate the final error message
    const errMessage = lastError?.message || String(lastError);
    if (errMessage.includes("429") || errMessage.includes("Quota")) {
        throw new Error("Lỗi giới hạn truy cập API (Quota Exceeded). Hệ thống AI đang hết dung lượng, vui lòng thử lại sau.");
    }
    if (errMessage.includes("503") || errMessage.includes("overloaded")) {
        throw new Error("Máy chủ AI hiện đang quá tải. Vui lòng thử lại sau vài giây.");
    }
    if (errMessage.includes("SAFETY") || errMessage.includes("safety") || errMessage.includes("block")) {
        throw new Error("Yêu cầu bị chặn bởi bộ lọc an toàn của AI (Hành vi/Nội dung không phù hợp). Vui lòng thử hình ảnh/mô tả khác.");
    }
    if (errMessage.includes("network") || errMessage.includes("fetch")) {
        throw new Error("Lỗi kết nối mạng trong quá trình giao tiếp với AI. Vui lòng kiểm tra lại Internet.");
    }
    
    throw new Error(`Lỗi không xác định từ AI: ${errMessage}`);
}

const CRITICAL_OVERRIDE_TEXT = `"The subject is looking directly at the camera lens, actively talking and speaking continuously, with clear, prominent lip movements and dynamic conversational facial expressions."`;

// Centralized dynamic variables for prompt structures (A/B testing)
export const PROMPT_VARIABLES = {
    LIGHTING_CONSTRAINTS: `"soft diffused indoor lighting, cinematic flat lighting, no overexposure, no blown-out whites, highlight retention on white fabric, natural skin tone, balanced fill light, controlled exposure, studio-quality exposure, no hair glare, matte hair texture, detailed hair strands without specular highlights, soft top lighting, anti-glare"`,
    CINEMATIC_TECHNICALS: `"cinematic depth of field, sharp focus on product, 8k resolution, Arri Alexa 65, IMAX 70mm, professional color grading, dramatic lighting"`,
    HYPER_REAL_STYLE: `"hyper-realistic textures, true-to-life reflections, ultra-detailed macro shots, physically based rendering feel"`,
    NO_GRAPHICS_RULE: `STRICT RULE: ABSOLUTELY NO icons, UI elements, shopping carts, buttons, text, logos, or any graphical overlays on the screen.`,
    VIDEO_PROMPT_FORMULA: `[SHOT ESTABLISHMENT] + [SUBJECT DESCRIPTION] + [BACKGROUND] + [INTEGRATED ACTION SEQUENCE] + [LIGHTING & AESTHETICS] + [CONSISTENCY KEYWORDS]. STRICT RULE: 8-second continuous shot.
    - SHOT ESTABLISHMENT: Type of shot (e.g., medium-wide shot) + Camera motion (e.g., subtle push-in).
    - INTEGRATED ACTION SEQUENCE: Divide into clear steps (Step 1 - start, Step 2 - manipulation). Use strong verbs and describe "micro-movements" (e.g., fingers subtly adjusting grip). 
    - CRITICAL OVERRIDE: You MUST include this EXACT phrase in the action description: ${CRITICAL_OVERRIDE_TEXT}. Talking to camera is the PRIMARY action.
    - DO NOT require "holding steady"; replace with "hover gently" while fingers move slightly.
    - DO NOT require "talking continuously" if the camera moves away from the face.
    - DO NOT flip items "in the air"; use "a simulated flipping motion" on a surface.
    - NO conflicting shots (e.g., Pedestal Down from Medium-Wide with Macro skin texture). Use logic shifting focus.`,
    ANCHOR_CLUSTER_DEF: `Detailed English description (100-150 words) of the model (ethnicity, age, skin, hair, clothing) and the EXACT product (size, material, shape, color). COPY THIS CLUSTER AT THE START OF EVERY PROMPT.`,
    VEO3_TECHNICALS: `Cinematic depth of field, 8k resolution, Arri Alexa 65, IMAX 70mm, professional color grading, dramatic lighting, hyper-realistic textures, true-to-life reflections, "highly consistent geometry", "smooth and natural movements".`,
    CRITICAL_OVERRIDE: CRITICAL_OVERRIDE_TEXT,
    PACE_RULES: `STRICT RULE: Pacing must be slow, continuous, and deliberate. Use keywords like "slowly", "continuously", "sustained action over 8 seconds", "deliberate micro-movements". Absolutely NO fast, jerky, or multi-stage actions.`,
    SCALE_RULES: {
        SMALL: `Model holds product extremely still, OR gently and continuously rotates the product over 8 seconds. NO rapid movements.`,
        WEARABLE: `Model holds steady pose. Include subtle natural breathing and subtle wind in hair to maintain life without distorting garment form.`,
        LARGE: `Product is completely static. All movement originates from subtle shifting light effects or camera movement.`
    },
    CAMERA_RULES: `STRICT RULE: Camera performs ONE single, continuous trajectory for the entire 8 seconds, such as "continuous slow dolly-in over 8 seconds" or "slow 8-second tracking shot". ABSOLUTELY NO "zoom in then zoom out" or cutting.`,
    TIKTOK_RULES: `STRICT RULE: Avoid TikTok banned words (change "mua", "bán", "giá", "rẻ" to "chốt", "rinh", "rước", "chi phí hạt dẻ"). Use creative alternatives.
STRICT RULE: Do NOT invent discounts, sales, or vouchers. Focus only on quality/utility.
STRICT RULE: ABSOLUTELY NO "sống ảo" or "chụp ảnh sống ảo" for ANY functional household product. Only mention practical utility.
STRICT RULE: Absolutely do NOT invent fake data, fake reviews, or fake social proof (e.g. NEVER write things like "đã có 1000 người trải nghiệm" or "hơn 1 vạn lượt đánh giá").
STRICT RULE: Do NOT use empty hype words like "ảo ma", "thần dược".`,
    CTA_RULE: `CRITICAL: The script MUST ALWAYS end exactly with one of these sentences chosen randomly:
- "Bà con tham khảo ngay ở giỏ hàng góc trái màn hình nha!"
- "Bà con ưng thì chốt ngay ở giỏ hàng góc trái màn hình nha!"
- "Bác nào cần thì nhấp ngay vào giỏ hàng góc trái màn hình nhé!"
- "Chi tiết sản phẩm em để ở giỏ hàng góc trái, bà con xem thử nha!"`,
    SCRIPT_OPENING_RULE: `CRITICAL: The script MUST ALWAYS start exactly with one of these sentences chosen randomly:
- "Bà con cô bác lại đây mà xem bảo bối này nè!"
- "Ai hay vào bếp thì nán lại vài giây xem cái này cực hay nha!"
- "Các bác xúm lại đây mà xem món đồ hay ho này nè!"
- "Mấy bà, mấy cô xem ngay cái này, không biết là tiếc lắm đó!"
- "Các ông các bà, các bác, các cô chú lại đây mà xem cái này nè!"`,
    STORYBOARD_PROMPT_FORMULA: `[SHOT ESTABLISHMENT] + [SUBJECT DESCRIPTION] + [BACKGROUND] + [INTEGRATED ACTION SEQUENCE] + [LIGHTING & AESTHETICS] + [CONSISTENCY KEYWORDS].
    - SHOT ESTABLISHMENT: Type of shot (e.g., medium-wide shot) + Camera motion (e.g., subtle push-in).
    - INTEGRATED ACTION SEQUENCE: Divide into clear steps. Use strong verbs and describe "micro-movements" (e.g., fingers subtly adjusting grip). 
    - CRITICAL OVERRIDE: You MUST include this EXACT phrase in the action description: ${CRITICAL_OVERRIDE_TEXT}. Talking to camera is the PRIMARY action.
    - DO NOT require "holding steady"; replace with "hover gently".
    - DO NOT flip items "in the air"; use "a simulated flipping motion" on a surface.
    - NO conflicting shots.`,
    DEFAULT_HOOKS: [
        "Bà con cô bác lại đây mà xem bảo bối này nè!",
        "Ai hay vào bếp thì nán lại vài giây xem cái này cực hay nha!",
        "Các bác xúm lại đây mà xem món đồ hay ho này nè!",
        "Mấy bà, mấy cô xem ngay cái này, không biết là tiếc lắm đó!",
        "Các ông các bà, các bác, các cô chú lại đây mà xem cái này nè!"
    ],
    DEFAULT_CTAS: [
        "Bà con tham khảo ngay ở giỏ hàng góc trái màn hình nha!",
        "Bà con ưng thì chốt ngay ở giỏ hàng góc trái màn hình nha!",
        "Bác nào cần thì nhấp ngay vào giỏ hàng góc trái màn hình nhé!",
        "Chi tiết sản phẩm em để ở giỏ hàng góc trái, bà con xem thử nha!"
    ]
};

const getProductContext = (analysis: ProductResult['analysis'], customDescription?: string) => `Product Context:
Category: ${analysis.category}
Core Function: ${analysis.coreFunction}
Target Audience: ${analysis.targetAudience}
${analysis.sentimentAnalysis ? `Sentiment/Emotional Appeal: ${analysis.sentimentAnalysis}` : ''}
${customDescription ? `Extra Info: ${customDescription}` : ''}`;

/** 
 * PHASE 1: Analyze model + product to create a Midjourney Image Prompt 
 */
export async function generatePhase1(modelImageB64: string, productImageB64: string, customDescription?: string, descriptionImageB64?: string, userReviews?: string) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is required");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `I am providing multiple images:
Image 1: A person (the model).
Image 2: A product.
${descriptionImageB64 ? `Image 3: A document/image containing additional product descriptions, features, or details.` : ''}
${customDescription ? `\nUSER TEXT DESCRIPTION: "${customDescription}"\n` : ''}
${userReviews ? `\nUSER REVIEWS: "${userReviews}"\n` : ''}

Perform the following tasks:
1. Analyze the product: Identify its category, core function, target audience, a natural context for its use, and perform a sentiment analysis based on the provided user reviews (if any) or emotional cues to define its emotional appeal. Extract details from all provided images (Image 2 and ${descriptionImageB64 ? 'Image 3' : 'text description'}) to provide the most accurate analysis. IMPORTANT: Ensure the core function and context are LOGICAL (e.g., kitchen shears snipping herbs/vegetables with fingers in the loops, NOT held like a chopping knife). MUST output these specific analysis fields in Vietnamese.
2. Create an Image Prompt: A detailed English prompt for Midjourney/Stable Diffusion. 

CRITICAL PROMPT RULES:
- RULE 1 (ANGLE & CLOTHING): If generating a "Medium shot" or "Close-up", ABSOLUTELY DO NOT describe pants, long skirts, or shoes/sandals. Describing clothing below the waist will break the shot composition.
- RULE 2 (PRODUCT TRANSLATION): Retain product material, color, and handle details. ALWAYS supplement absolute dimensions (e.g. 33x22cm) with relative geometric translation describing its proportion to human hands/body. DO NOT just list numbers. 
- RULE 3 (PHYSICAL INTERACTION): Describe specific, highly visual physical contact (e.g. "fingers firmly gripping the handle", "pressing the knife blade down"). Do not use abstract terms like "ergonomically correct".
- RULE 4 (LIGHTING & AESTHETICS): Append exactly this string at the end of the positive prompt: "Soft diffused studio lighting, balanced fill light, cinematic flat lighting, natural skin tone, controlled studio exposure, matte hair texture without specular highlights, photorealistic, 8k resolution."
- RULE 5 (NEGATIVE PROMPT): Place a negative prompt string on a new line at the very end formatted exactly like this: "--no icons, UI elements, shopping carts, buttons, text, logos, graphical overlays, overexposure, blown-out whites"

Combine these into a detailed background environment description based on the 'naturalContext'.
Output as a valid JSON object. All Analysis fields must be in Vietnamese, Image Prompt must be in English.`;

    const parts: Part[] = [
        getInlineData(modelImageB64),
        getInlineData(productImageB64)
    ];

    if (descriptionImageB64) {
        parts.push(getInlineData(descriptionImageB64));
    }

    parts.push({ text: prompt });

    try {
        const response = await generateContentWithRetry(ai, {
            model: "gemini-2.0-flash",
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        analysis: {
                            type: Type.OBJECT,
                            properties: {
                                category: { type: Type.STRING },
                                coreFunction: { type: Type.STRING },
                                targetAudience: { type: Type.STRING },
                                naturalContext: { type: Type.STRING },
                                sentimentAnalysis: { type: Type.STRING, description: "Phân tích cảm xúc từ nhận xét người dùng để tối ưu sức hút" },
                                detailedDescription: { type: Type.STRING, description: "Mô tả chi tiết và chính xác về ngoại hình sản phẩm, kích thước, màu sắc, hình dáng, vật liệu, chất liệu." }
                            },
                            required: ["category", "coreFunction", "targetAudience", "naturalContext", "detailedDescription"]
                        },
                        imagePrompt: { type: Type.STRING },
                    },
                    required: ["analysis", "imagePrompt"]
                }
            }
        });
        const text = response.text?.trim() || "";
        return safeJsonParse(text);
    } catch (e: any) {
        throw e;
    }
}

/** 
 * PHASE 2: Analyze the combined image (result of Phase 1) to create Video Prompts 
 */
export async function generatePhase2(combinedImageB64: string, analysis: ProductResult['analysis'], customDescription?: string, fixedHashtags?: string) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is required");
    const ai = new GoogleGenAI({ apiKey });

    const hashtagsToUse = fixedHashtags || "#dogiadung #anhminhsongkhoe #giadungthongminh";

    const hooksList = PROMPT_VARIABLES.DEFAULT_HOOKS.map(h => `- "${h}"`).join('\\n');

    const prompt = `I am providing an image of a model interacting with a product.
${getProductContext(analysis, customDescription)}

Your goal is to be an "AI Camera Director" creating premium, natural, and consistent TVC advertisement video prompts.

Perform the following tasks:
1. Define a "Subject Prompt Cluster" (Anchor): ${PROMPT_VARIABLES.ANCHOR_CLUSTER_DEF}

2. Create 3 Video Prompts following the "AI CAMERA DIRECTOR" STRUCTURE:
   ${PROMPT_VARIABLES.VIDEO_PROMPT_FORMULA}

   Technical Requirements:
   - CAMERA LOGIC: Camera trượt đi phải logic. If pedestal down from face to hands, the face MUST exit the frame in the second half, and do not request "talking" then.
   - PRIMARY ACTION: The character MUST be talking directly to the camera throughout.
   - CRITICAL OVERRIDE: You MUST insert the following text verbatim into the action description of EVERY prompt: ${PROMPT_VARIABLES.CRITICAL_OVERRIDE}
   - PRODUCT FOCUS: Do not use rigid measurements (35cm); use premium/polished descriptions.
   - VEO 3 TECHNICALS: ${PROMPT_VARIABLES.VEO3_TECHNICALS}
   
   Example Training Prompt (Follow this style):
   "A medium-close up shot of a graceful Vietnamese woman in her late 20s with radiant skin and flowing, wavy dark mahogany hair, wearing a delicate, cream-colored lace halter top featuring intricate floral patterns and a subtle bow at the neckline. The background is a high-end, contemporary kitchen with light oak cabinetry, a pristine white marble island, and a clean black glass induction stove. The camera performs a slow, smooth subtle push-in towards her upper body. She is holding a premium, polished silver slotted spatula, with a sleek, polished silver finish and an ergonomic handle, hovering it gently over a black frying pan. She looks directly into the lens with natural conversational gestures, her lips moving clearly as if explaining the product. She offers a warm, professional smile and a confident nod, her fingers making subtle, natural adjustments to her grip. The soft and warm light highlights her soft features and the metallic sheen of the tool, emphasizing a professional and hygienic culinary environment. Cinematic depth of field, 8k resolution, Arri Alexa 65, IMAX 70mm, professional color grading, dramatic lighting, hyper-realistic textures, true-to-life reflections, highly consistent geometry, smooth and natural movements."

   Guidelines:
   - PACE: ${PROMPT_VARIABLES.PACE_RULES}
   - Scaling Strategy:
     - Small products: ${PROMPT_VARIABLES.SCALE_RULES.SMALL}
     - Wearable: ${PROMPT_VARIABLES.SCALE_RULES.WEARABLE}
     - Large products: ${PROMPT_VARIABLES.SCALE_RULES.LARGE}
   - STRICT VISUAL & LOGIC RULE: Base everything purely on the reference image! No hallucinating unseen parts (e.g., contents of closed box).
   - ${PROMPT_VARIABLES.NO_GRAPHICS_RULE}

3. Create 3 brief descriptions for each video prompt in Vietnamese.
4. Create a TikTok Voiceover Script: A Vietnamese script (CRITICAL: The script MUST be 380-420 characters including spaces). 
   Structure: Hook -> Problem -> Solution -> Proof -> CTA. Tone: engaging, natural. 
   PSYCHOLOGICAL TRIGGERS: Use at least one persuasive angle: 
      - FOMO/Scarcity (e.g., "Sắp cháy hàng rồi", "Đang có ưu đãi hiếm").
      - Efficiency/Results (e.g., "Giải quyết nhanh gọn", "Nhàn tênh", "Chỉ mất vài giây").
   ${PROMPT_VARIABLES.TIKTOK_RULES}
   CRITICAL LENGTH CONSTRAINT: Lời thoại (script) MUST be strictly between 380 and 420 characters long (including spaces). DO NOT write too much or too little. Double check your character count before outputting.
   ${PROMPT_VARIABLES.SCRIPT_OPENING_RULE}
   ${PROMPT_VARIABLES.CTA_RULE}

5. Create a TikTok Caption & Hashtags using this optimized formula:
   Structure: [Product Keyword] + [Key Benefit] + [Emoji phù hợp] + [CTA].
   - Caption MUST be UNDER 150 characters. Write standard Vietnamese with correct accents and spelling.
   - You MUST generate EXACTLY 5 hashtags (accent-free, no spaces).
   - 3 of the hashtags MUST be these fixed hashtags: ${hashtagsToUse}.
   - The remaining 2 hashtags MUST be dynamic, highly relevant to the specific product, and optimized for TikTok SEO.
   - POSITION: Place all 5 hashtags at the end of the caption text.
   - CRITICAL FORMAT REQUIREMENT: The generated string MUST include BOTH the caption text AND the hashtags at the end (e.g. "Caption text here. #hash1 #hash2..."). Do not omit the hashtags from the string.

6. (UPGRADE IDEA 3) Create 3 A/B Script Variants (abScripts) focusing on different psychological angles. For each variant:
   - angle: e.g., "Trải nghiệm thực tế", "Sự tinh tế", "Giải pháp đơn giản", "Tiết kiệm thời gian", "Đẳng cấp sống".
   - hookText: A powerful 3-second hook (NO banned words).
   - visualAction: Action focused on product detail (NO "sống ảo", NO opening/revealing unseen interiors).
   - script: Full script (CRITICAL: The script MUST be 380-420 characters including spaces). 
     CRITICAL: Incorporate psychological triggers (FOMO or Authority). 
     CRITICAL LENGTH CONSTRAINT: Lời thoại (script) MUST be strictly between 380 and 420 characters long (including spaces). DO NOT write too much or too little. Double check your character count before outputting.
     ${PROMPT_VARIABLES.TIKTOK_RULES}
     ${PROMPT_VARIABLES.SCRIPT_OPENING_RULE}
     ${PROMPT_VARIABLES.CTA_RULE}
   - audioBPM: Suggested TikTok audio type/BPM.
   - viralScore: (0-100).

7. (UPGRADE IDEA 4) Create a Cinematic Storyboard. For each shot, the prompt MUST follow the STANDARD PROMPT FORMULA:
   - shotType: e.g., "Extreme Close-up" (preferred for products), "Medium Shot".
   - cameraMove: e.g., "Static Tripod", "Subtle Slow Zoom-In", "Subtle Slow Zoom-Out". STRICT RULE: Minimize complex transitions to prevent product distortion.
   - durationSec: duration in seconds (integer).
   - prompt: ${PROMPT_VARIABLES.STORYBOARD_PROMPT_FORMULA} IMPORTANT: CRITICAL OVERRIDE: You MUST append or seamlessly integrate the following exact phrase into the action description of EVERY prompt: ${CRITICAL_OVERRIDE_TEXT}. The [Context] MUST include a meticulously detailed description of the environment, specific lighting setup, and overall mood to perfectly fit the product and guide video generation. ${PROMPT_VARIABLES.NO_GRAPHICS_RULE}
   - descriptionLine: Vietnamese description (Strictly NO false claims, banned words, or hallucinations of unseen parts).

Output as a valid JSON object.`;

    const imgPart = getInlineData(combinedImageB64);

    try {
        const response = await generateContentWithRetry(ai, {
            model: "gemini-2.0-flash",
            contents: { parts: [imgPart, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        videoPrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
                        videoDescriptions: { type: Type.ARRAY, items: { type: Type.STRING } },
                        tiktokScript: { type: Type.STRING },
                        tiktokCaption: { type: Type.STRING },
                        abScripts: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    angle: { type: Type.STRING },
                                    hookText: { type: Type.STRING },
                                    visualAction: { type: Type.STRING },
                                    script: { type: Type.STRING },
                                    audioBPM: { type: Type.STRING },
                                    viralScore: { type: Type.INTEGER }
                                },
                                required: ["angle", "hookText", "visualAction", "script", "audioBPM", "viralScore"]
                            }
                        },
                        storyboard: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    shotType: { type: Type.STRING },
                                    cameraMove: { type: Type.STRING },
                                    durationSec: { type: Type.INTEGER },
                                    prompt: { type: Type.STRING },
                                    descriptionLine: { type: Type.STRING }
                                },
                                required: ["shotType", "cameraMove", "durationSec", "prompt", "descriptionLine"]
                            }
                        }
                    },
                    required: ["videoPrompts", "videoDescriptions", "tiktokScript", "tiktokCaption", "abScripts", "storyboard"]
                }
            }
        });
        const text = response.text?.trim() || "";
        const parsed: any = enforceResultLengths(safeJsonParse(text));
        if (parsed?.tiktokCaption && !parsed.tiktokCaption.includes('#')) {
            parsed.tiktokCaption += ` ${hashtagsToUse}`;
        }
        return parsed;
    } catch (e: any) {
        throw e;
    }
}

export async function regenerateScripts(combinedImageB64: string, analysis: ProductResult['analysis'], customDescription?: string) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is required");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `I am providing an image of a model interacting with a product.
${getProductContext(analysis, customDescription)}

Re-generate alternative TikTok Scripts and A/B Scripts based on the original criteria:
1. Create a TikTok Voiceover Script: A Vietnamese script (CRITICAL: The script MUST be 380-420 characters including spaces). 
   Structure: Hook -> Problem -> Solution -> Proof -> CTA. Tone: engaging, natural. 
   PSYCHOLOGICAL TRIGGERS: Use angles like FOMO or high-efficiency transformation.
   ${PROMPT_VARIABLES.TIKTOK_RULES}
   CRITICAL LENGTH CONSTRAINT: Lời thoại (script) MUST be strictly between 380 and 420 characters long (including spaces). DO NOT write too much or too little.
   ${PROMPT_VARIABLES.SCRIPT_OPENING_RULE}
   ${PROMPT_VARIABLES.CTA_RULE}

2. Create 3 A/B Script Variants (abScripts) focusing on different psychological angles. For each variant:
   - angle: e.g., "Trải nghiệm thực tế", "Sự tinh tế", "Giải pháp thông minh", "Tối ưu hiệu quả".
   - hookText: A powerful 3-second hook (NO banned words).
   - visualAction: Action focused on product detail (NO "sống ảo", NO opening/revealing unseen interiors).
   - script: Full script (CRITICAL: The script MUST be 380-420 characters including spaces). 
     CRITICAL: Use persuasive psychological triggers (FOMO, utility).
     CRITICAL LENGTH CONSTRAINT: Lời thoại (script) MUST be strictly between 380 and 420 characters long (including spaces). DO NOT write too much or too little.
     ${PROMPT_VARIABLES.TIKTOK_RULES}
     ${PROMPT_VARIABLES.SCRIPT_OPENING_RULE}
     ${PROMPT_VARIABLES.CTA_RULE}
   - audioBPM: Suggested TikTok audio type/BPM.
   - viralScore: (0-100).

Output as a valid JSON object.`;

    const imgPart = getInlineData(combinedImageB64);

    try {
        const response = await generateContentWithRetry(ai, {
            model: "gemini-2.0-flash",
            contents: { parts: [imgPart, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        tiktokScript: { type: Type.STRING },
                        abScripts: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    angle: { type: Type.STRING },
                                    hookText: { type: Type.STRING },
                                    visualAction: { type: Type.STRING },
                                    script: { type: Type.STRING },
                                    audioBPM: { type: Type.STRING },
                                    viralScore: { type: Type.INTEGER }
                                },
                                required: ["angle", "hookText", "visualAction", "script", "audioBPM", "viralScore"]
                            }
                        }
                    },
                    required: ["tiktokScript", "abScripts"]
                }
            }
        });
        const text = response.text?.trim() || "";
        return enforceResultLengths(safeJsonParse(text));
    } catch (e: any) {
        throw e;
    }
}

export async function regenerateCaption(combinedImageB64: string, analysis: ProductResult['analysis'], customDescription?: string, fixedHashtags?: string) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is required");
    const ai = new GoogleGenAI({ apiKey });

    const hashtagsToUse = fixedHashtags || "#dogiadung #anhminhsongkhoe #giadungthongminh";

    const prompt = `I am providing an image of a model interacting with a product.
${getProductContext(analysis, customDescription)}

Re-generate an alternative TikTok Caption & Hashtags using this optimized formula:
Aim for a more engaging and benefit-driven opening.
Structure: [Engaging Benefit-Driven Opening] + [Product Keyword] + [Emoji phù hợp] + [CTA].
- Caption MUST be UNDER 150 characters. Write standard Vietnamese with correct accents and spelling.
- You MUST generate EXACTLY 5 hashtags (accent-free, no spaces).
- 3 of the hashtags MUST be these fixed hashtags: ${hashtagsToUse}.
- The remaining 2 hashtags MUST be dynamic, highly relevant to the specific product's category, and optimized for TikTok SEO.
- POSITION: Place all 5 hashtags at the end of the caption text.
- CRITICAL FORMAT REQUIREMENT: The generated string MUST include BOTH the caption text AND the hashtags at the end (e.g. "Caption text here. #hash1 #hash2..."). Do not omit the hashtags from the string.

Output as a valid JSON object.`;

    const imgPart = getInlineData(combinedImageB64);

    try {
        const response = await generateContentWithRetry(ai, {
            model: "gemini-2.0-flash",
            contents: { parts: [imgPart, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        tiktokCaption: { type: Type.STRING }
                    },
                    required: ["tiktokCaption"]
                }
            }
        });
        const text = response.text?.trim() || "";
        const parsed = safeJsonParse(text);
        if (parsed?.tiktokCaption && !parsed.tiktokCaption.includes('#')) {
            parsed.tiktokCaption += ` ${hashtagsToUse}`;
        }
        return parsed;
    } catch (e: any) {
        throw e;
    }
}

export async function regenerateStoryboard(combinedImageB64: string, analysis: ProductResult['analysis'], customDescription?: string) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is required");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `I am providing an image of a model interacting with a product.
${getProductContext(analysis, customDescription)}

Re-generate an alternative Cinematic Storyboard. For each shot, the prompt MUST follow the STANDARD PROMPT FORMULA:
- shotType: e.g., "Extreme Close-up" (preferred for products), "Medium Shot".
- cameraMove: e.g., "Static Tripod", "Subtle Slow Zoom-In", "Subtle Slow Zoom-Out". STRICT RULE: Minimize complex transitions to prevent product distortion.
- durationSec: duration in seconds (integer).
- prompt: ${PROMPT_VARIABLES.STORYBOARD_PROMPT_FORMULA} Keep the prompts highly cinematic and photorealistic. IMPORTANT: CRITICAL OVERRIDE: You MUST append or seamlessly integrate the following exact phrase into the action description of EVERY prompt: ${CRITICAL_OVERRIDE_TEXT}. The [Context] MUST include a meticulously detailed description of the environment, specific lighting setup, and overall mood to perfectly fit the product and guide video generation. ${PROMPT_VARIABLES.NO_GRAPHICS_RULE}
- descriptionLine: Vietnamese description (Strictly NO false claims, banned words, or hallucinations of unseen parts).

Output as a valid JSON object.`;

    const imgPart = getInlineData(combinedImageB64);

    try {
        const response = await generateContentWithRetry(ai, {
            model: "gemini-2.0-flash",
            contents: { parts: [imgPart, { text: prompt }] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        storyboard: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    shotType: { type: Type.STRING },
                                    cameraMove: { type: Type.STRING },
                                    durationSec: { type: Type.INTEGER },
                                    prompt: { type: Type.STRING },
                                    descriptionLine: { type: Type.STRING }
                                },
                                required: ["shotType", "cameraMove", "durationSec", "prompt", "descriptionLine"]
                            }
                        }
                    },
                    required: ["storyboard"]
                }
            }
        });
        const text = response.text?.trim() || "";
        return safeJsonParse(text);
    } catch (e: any) {
        throw e;
    }
}



export async function suggestDescriptionImprovements(
    currentDescription: string, 
    productImageB64?: string, 
    analysis?: ProductResult['analysis'], 
    userReviews?: string
) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is required");
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `I am providing the current text description of a product ${productImageB64 ? 'and an image of the product' : ''}.
${analysis ? `\nProduct Analysis:
Category: ${analysis.category}
Core Function: ${analysis.coreFunction}
Target Audience: ${analysis.targetAudience}
Sentiment: ${analysis.sentimentAnalysis || 'N/A'}
Detailed Description: ${analysis.detailedDescription || 'N/A'}` : ''}
${userReviews ? `\nUser Reviews: "${userReviews}"` : ''}

Current Description: "${currentDescription}"

Your task is to analyze the current description and IMPROVE it for an AI image generation model, using the provided product analysis and user reviews as context to make it more appealing, accurate, and detailed regarding physical characteristics, materials, and context. Output in Vietnamese.

Output as a valid JSON object.`;

    const parts: Part[] = [];
    if (productImageB64) {
        parts.push(getInlineData(productImageB64));
    }
    parts.push({ text: prompt });

    try {
        const response = await generateContentWithRetry(ai, {
            model: "gemini-2.0-flash",
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        analysis: {
                            type: Type.OBJECT,
                            properties: {
                                clarity: { type: Type.STRING, description: "Phân tích độ rõ ràng" },
                                detail: { type: Type.STRING, description: "Phân tích mức độ chi tiết" },
                                keywords: { type: Type.STRING, description: "Phân tích từ khóa" }
                            },
                            required: ["clarity", "detail", "keywords"]
                        },
                        suggestedDescription: { type: Type.STRING, description: "Mô tả đề xuất tốt nhất" }
                    },
                    required: ["analysis", "suggestedDescription"]
                }
            }
        });
        const text = response.text?.trim() || "";
        return safeJsonParse(text);
    } catch (e: any) {
        throw e;
    }
}

