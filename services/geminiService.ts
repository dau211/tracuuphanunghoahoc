import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { ReactionData } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY is not defined in environment variables");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    reactionOccurs: {
      type: Type.BOOLEAN,
      description: "Liệu phản ứng có xảy ra không."
    },
    equation: {
      type: Type.STRING,
      description: "Phương trình hóa học đã cân bằng. Nếu phụ thuộc điều kiện mà người dùng chưa nhập, trả về chuỗi thông báo 'Xem các trường hợp bên dưới'."
    },
    explanation: {
      type: Type.STRING,
      description: "Giải thích chi tiết. Dùng TIẾNG VIỆT để diễn đạt, nhưng tên chất phải là TIẾNG ANH (IUPAC). Nếu có nhiều trường hợp, liệt kê đầy đủ."
    },
    isUserCorrect: {
        type: [Type.BOOLEAN, Type.NULL],
        description: "Liệu dự đoán của người dùng về sản phẩm có đúng không. Null nếu người dùng không cung cấp dự đoán."
    },
    feedback: {
        type: Type.STRING,
        description: "Phản hồi cho người dùng. Dùng TIẾNG VIỆT để diễn đạt, tên chất là TIẾNG ANH (IUPAC)."
    },
    videos: {
      type: Type.ARRAY,
      description: "Danh sách 3 từ khóa tìm kiếm video Youtube.",
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "Từ khóa tìm kiếm video (Nên dùng tên tiếng Anh của phản ứng để ra kết quả chuẩn xác hơn)."
          }
        },
        required: ["title"]
      }
    },
    imageData: {
      type: Type.OBJECT,
      description: "Nếu phản ứng có cấu trúc phức tạp (hữu cơ, ion phức), hãy tìm MỘT URL hình ảnh (.png, .jpg) công khai, trực tiếp và rõ ràng nhất. Nếu không, hãy bỏ qua trường này.",
      properties: {
        url: {
          type: Type.STRING,
          description: "URL trực tiếp đến file hình ảnh."
        },
        alt: {
          type: Type.STRING,
          description: "Mô tả ngắn gọn hình ảnh bằng tiếng Việt (VD: 'Công thức cấu tạo của ethanol')."
        }
      },
      required: ["url", "alt"]
    }
  },
  required: ["reactionOccurs", "equation", "explanation", "isUserCorrect", "feedback", "videos"]
};

// Hàm hỗ trợ tự động thử lại khi gặp lỗi quá tải (429)
const runWithRetry = async <T>(operation: () => Promise<T>, retries = 3, backoff = 2000): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    const isQuotaError = 
        error?.status === 429 || 
        (error?.message && (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')));

    if (isQuotaError && retries > 0) {
      await new Promise(resolve => setTimeout(resolve, backoff));
      return runWithRetry(operation, retries - 1, backoff * 2);
    }
    
    if (isQuotaError) {
        throw new Error("Hệ thống đang quá tải do giới hạn miễn phí của Google Gemini. Vui lòng đợi 1-2 phút và thử lại.");
    }
    throw error;
  }
};

export const getReactionInfo = async (reactants: string, userProducts: string): Promise<ReactionData> => {
  const hasUserProducts = userProducts && userProducts.trim() !== '';

  const prompt = `Bạn là hệ thống hỗ trợ Hóa học chuyên sâu dành cho học sinh THPT Việt Nam.

**NGUỒN DỮ LIỆU BẮT BUỘC (TUYỆT ĐỐI TUÂN THỦ):**
1. **NGUỒN VIETJACK LÀ SỐ 1:**
   - Hệ thống **PHẢI** tìm kiếm và trích xuất nội dung (phương trình, điều kiện, hiện tượng, giải thích chi tiết) **Y NGUYÊN** từ kho dữ liệu của website **https://vietjack.com**.
   - Nếu phản ứng có trên Vietjack, ưu tiên tuyệt đối cách diễn đạt và nội dung từ trang này.
2. **NGUỒN DỰ PHÒNG:**
   - Chỉ khi **TUYỆT ĐỐI KHÔNG TÌM THẤY** thông tin trên Vietjack, mới được phép tham khảo các nguồn khác.
   - Các nguồn khác này bắt buộc phải nằm trong Sách Giáo Khoa Hóa học 10, 11, 12 theo **Chương trình GDPT 2018** (Bộ sách: Cánh Diều, Kết Nối Tri Thức, Chân Trời Sáng Tạo).

**QUY TẮC NGÔN NGỮ "BẤT KHẢ XÂM PHẠM":**
1. **TÊN CHẤT HÓA HỌC:**
   - **BẮT BUỘC** viết bằng **TIẾNG ANH** chuẩn quốc tế (IUPAC) hoặc tên thông dụng quốc tế (VD: Iron, Sulfuric acid, Sodium hydroxide...).
   - **TUYỆT ĐỐI KHÔNG** dùng tên tiếng Việt cho chất hóa học trong câu trả lời (Không dùng: Sắt, Axit clohidric...).
   - Nếu Input là tiếng Việt (VD: "Nhôm"), hãy tự động hiểu và chuyển thành "Aluminium" trong Output.
2. **PHẦN GIẢI THÍCH & NHẬN XÉT:**
   - Toàn bộ nội dung diễn giải, mô tả hiện tượng, điều kiện, câu nối... **PHẢI** viết bằng **TIẾNG VIỆT**.

**QUY TẮC XỬ LÝ PHẢN ỨNG (LOGIC HÓA HỌC):**
1. **Phạm vi kiến thức:**
   - Chỉ dùng kiến thức THPT (Lớp 10, 11, 12).
   - Không dùng kiến thức cũ (đơn vị atm cũ, khái niệm đã bỏ).
   - Không dùng kiến thức Đại học (cơ chế, lượng tử...).
2. **Xử lý ĐIỀU KIỆN PHẢN ỨNG (Quan trọng):**
   - **Trường hợp 1:** Phản ứng chỉ có 1 hướng duy nhất hoặc không phụ thuộc điều kiện --> Trả về phương trình bình thường.
   - **Trường hợp 2:** Phản ứng phụ thuộc điều kiện (nhiệt độ, đặc/loãng, tỉ lệ mol...) VÀ người dùng **KHÔNG** ghi rõ điều kiện:
     - Tại trường \`equation\`: Trả về chuỗi "**Tùy thuộc vào điều kiện (xem chi tiết)**".
     - Tại trường \`explanation\`: Bạn phải **LIỆT KÊ** các trường hợp có thể xảy ra.
     - *Ví dụ:* Fe + HNO3 (không nói rõ loãng/đặc):
       - TH1: HNO3 đặc, nóng -> Fe(NO3)3 + NO2 + H2O.
       - TH2: HNO3 loãng -> Fe(NO3)3 + NO + H2O.
   - **Trường hợp 3:** Người dùng đã ghi rõ điều kiện --> Trả về phương trình duy nhất đúng với điều kiện đó.
3. **QUY TẮC VỀ HÌNH ẢNH (imageData):**
   - **Xác định:** Nếu phản ứng có chứa hợp chất hữu cơ hoặc các ion phức tạp mà công thức cấu tạo giúp người học dễ hình dung (ví dụ: phản ứng este hóa, cracking, vòng benzene...), hãy thực hiện bước tiếp theo.
   - **Tìm URL trực tiếp:** Cố gắng tìm một URL **TRỰC TIẾP** tới file hình ảnh (.png, .jpg, .gif) công khai và còn hoạt động. URL phải là link đến file ảnh, không phải link đến trang web chứa ảnh.
   - **Nếu không tìm được:** Đối với các phản ứng vô cơ đơn giản (ví dụ: Fe + HCl) hoặc khi không tìm thấy URL ảnh đáng tin cậy, hãy **bỏ qua (không bao gồm)** trường \`imageData\` trong kết quả JSON.
   - **Mô tả (alt):** Luôn cung cấp mô tả ngắn gọn bằng tiếng Việt cho hình ảnh.

**Input:**
- Chất tham gia (Đề bài): "${reactants}"
${hasUserProducts ? `- Bài làm của user (Có thể là sản phẩm hoặc full phương trình): "${userProducts}"` : '- User đang tra cứu.'}

**Nhiệm vụ:** Trả về JSON. Trong \`explanation\`: Dùng dấu gạch đầu dòng (-) để liệt kê. In đậm (**text**) tên chất IUPAC.`;

  try {
    const response = await runWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      },
    }));
    
    const text = response.text;
    if (!text) throw new Error("Không nhận được phản hồi văn bản từ Gemini.");
    const jsonText = text.trim();
    const data = JSON.parse(jsonText);
    
    // Validate types
    if (
        typeof data.reactionOccurs !== 'boolean' ||
        typeof data.equation !== 'string' ||
        typeof data.explanation !== 'string' ||
        (data.isUserCorrect !== null && typeof data.isUserCorrect !== 'boolean') ||
        typeof data.feedback !== 'string' ||
        !Array.isArray(data.videos)
    ) {
        throw new Error("Dữ liệu API trả về không hợp lệ.");
    }
    
    return data as ReactionData;
    
  } catch (error: any) {
    console.error("Lỗi khi gọi Gemini API:", error);
    if (error.message && error.message.includes("Hệ thống đang quá tải")) {
        throw error;
    }
    throw new Error("Không thể lấy dữ liệu từ Gemini. Vui lòng thử lại.");
  }
};

export const generatePracticeQuestion = async (): Promise<string> => {
  const prompt = `Tạo ngẫu nhiên ĐÚNG 1 (MỘT) cặp chất tham gia phản ứng hóa học THPT (CT GDPT 2018).

**YÊU CẦU NGHIÊM NGẶT:**
1. Chỉ trả về **1 phản ứng duy nhất**. KHÔNG tạo danh sách nhiều phản ứng.
2. Chỉ trả về **KÝ HIỆU HÓA HỌC** (Formula) của chất tham gia.
3. **TUYỆT ĐỐI KHÔNG** kèm theo tên gọi tiếng Anh hay tiếng Việt.
4. **CHƯA CÂN BẰNG** (Unbalanced inputs): Không thêm hệ số cân bằng.
5. Kèm điều kiện nếu cần thiết trong ngoặc đơn.

Ví dụ đúng: "Fe + HCl"
Ví dụ sai: "Fe + HCl; Cu + HNO3" (Sai vì trả về 2 phản ứng)

Output format: Chỉ chuỗi công thức, ngăn cách bởi dấu cộng (+).`;
  
  try {
    const response = await runWithRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "text/plain",
      }
    }));
    const text = response.text;
    if (!text) throw new Error("Không nhận được câu hỏi từ Gemini.");
    return text.trim();
  } catch (error: any) {
    console.error("Lỗi tạo câu hỏi:", error);
    if (error.message && error.message.includes("Hệ thống đang quá tải")) {
        throw error;
    }
    throw new Error("Không thể tạo câu hỏi luyện tập.");
  }
};