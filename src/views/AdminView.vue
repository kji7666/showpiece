<script setup>
import { ref, reactive } from 'vue';
import { supabase } from '@/supabase';
import { useToast } from "vue-toastification";

const toast = useToast(); // <--- 初始化
const isLoading = ref(false);
const uploadStatus = ref('');

// --- 主材質資訊 (Parent Material) ---
const form = reactive({
  name: '',
  brand: '',
  category: '超耐磨木地板',
  price: 0,
  isPremium: false,
  description: '',
  coverFile: null // 主封面圖 (用於列表頁顯示)
});

// --- 變體列表 (Variants) ---
// 預設先給一組空的
const variants = ref([
  { id: Date.now(), code: '', imageFile: null, zipFile: null }
]);

// 新增一個變體欄位
const addVariant = () => {
  variants.value.push({ id: Date.now(), code: '', imageFile: null, zipFile: null });
};

// 移除變體欄位
const removeVariant = (index) => {
  if (variants.value.length > 1) {
    variants.value.splice(index, 1);
  } else {
    toast.warning('至少需要包含一個變體');
  }
};

// 處理檔案選擇
const handleMainCover = (event) => {
  form.coverFile = event.target.files[0];
};

const handleVariantFile = (event, index, type) => {
  const file = event.target.files[0];
  if (type === 'image') variants.value[index].imageFile = file;
  if (type === 'zip') variants.value[index].zipFile = file;
};

// 上傳輔助函式
const uploadToStorage = async (file, folder) => {
  if (!file) return null;
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;
  const filePath = `${folder}/${fileName}`;
  
  const { error } = await supabase.storage
    .from('pbr-files') // Bucket 名稱 (小寫)
    .upload(filePath, file);

  if (error) throw error;
  return filePath;
};

// --- 送出表單 (核心邏輯) ---
const handleSubmit = async () => {
  // 基本驗證
  if (!form.name || !form.coverFile) {
    toast.warning('請填寫商品名稱並上傳主封面圖');
    return;
  }
  
  // 檢查變體是否完整
  for (const v of variants.value) {
    if (!v.code || !v.zipFile) {
      toast.warning(`請完整填寫變體資訊 (色號與 ZIP 檔是必填的)`);
      return;
    }
  }

  try {
    isLoading.value = true;
    uploadStatus.value = '1/3 上傳主封面圖...';

    // 1. 上傳主材質封面
    const mainCoverPath = await uploadToStorage(form.coverFile, 'covers');
    // 在真實場景，封面圖通常需要 Public URL，這裡我們用 getPublicUrl 取得全網址存入 DB
    const { data: { publicUrl: mainCoverUrl } } = supabase.storage.from('pbr-files').getPublicUrl(mainCoverPath);

    uploadStatus.value = '2/3 建立主材質資料...';

    // 2. 寫入 Materials 表
    const { data: material, error: matError } = await supabase
      .from('materials')
      .insert([{
        name: form.name,
        brand: form.brand,
        category: form.category,
        price: form.price,
        is_premium: form.isPremium,
        description: form.description,
        cover_image: mainCoverUrl // 存公開連結方便前端顯示
      }])
      .select()
      .single();

    if (matError) throw matError;

    // 3. 迴圈處理所有變體 (上傳圖片+ZIP -> 寫入 DB)
    let count = 0;
    for (const v of variants.value) {
      count++;
      uploadStatus.value = `3/3 處理變體 ${count}/${variants.value.length}...`;

      // 上傳變體預覽圖 (如果有)
      let variantImageUrl = mainCoverUrl; // 預設用主圖
      if (v.imageFile) {
        const vPath = await uploadToStorage(v.imageFile, 'covers');
        variantImageUrl = supabase.storage.from('pbr-files').getPublicUrl(vPath).data.publicUrl;
      }

      // 上傳變體 ZIP (重要！)
      const zipPath = await uploadToStorage(v.zipFile, 'zips');

      // 寫入 Material_Variants 表
      const { error: varError } = await supabase
        .from('material_variants')
        .insert([{
          material_id: material.id,
          code: v.code,       // 例如: ST-01
          image: variantImageUrl,
          file_path_1k: zipPath, // 存入 Storage 路徑 (私有)
          // 這裡未來可以擴充 file_path_2k, 4k...
        }]);

      if (varError) throw varError;
    }

    toast.warning('✅ 商品與所有變體上架成功！');
    // 簡單重整頁面清空表單
    window.location.reload();

  } catch (error) {
    console.error(error);
    toast.warning('上架失敗：' + error.message);
  } finally {
    isLoading.value = false;
    uploadStatus.value = '';
  }
};
</script>

<template>
  <div class="min-h-screen pt-24 pb-20 px-4 bg-[#121212] text-white">
    <div class="max-w-4xl mx-auto">
      
      <h1 class="text-3xl font-bold mb-8 flex items-center gap-3">
        <span>📦</span> 管理員後台：上架新材質
      </h1>

      <form @submit.prevent="handleSubmit" class="space-y-8">
        
        <!--區塊 1: 主材質資訊 -->
        <div class="bg-[#1E1E1E] p-6 rounded-xl border border-gray-800 shadow-lg">
          <h2 class="text-xl font-bold mb-4 text-blue-400">1. 基本資訊</h2>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="label">商品名稱</label>
              <input v-model="form.name" type="text" placeholder="例如: 皇家橡木" required class="input-dark">
            </div>
            <div>
              <label class="label">品牌/廠商</label>
              <input v-model="form.brand" type="text" placeholder="例如: 如意" class="input-dark">
            </div>
            <div>
              <label class="label">分類</label>
              <select v-model="form.category" class="input-dark">
                <option>超耐磨木地板</option>
                <option>實木地板</option>
                <option>石材</option>
                <option>金屬</option>
                <option>布料</option>
              </select>
            </div>
            <div>
              <label class="label">價格 (USD)</label>
              <input v-model="form.price" type="number" class="input-dark">
            </div>
          </div>

          <div class="mt-4 flex items-center gap-2">
            <input v-model="form.isPremium" type="checkbox" id="premium" class="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-600">
            <label for="premium" class="cursor-pointer">設為付費商品 (Premium)</label>
          </div>

          <div class="mt-4">
            <label class="label">商品描述</label>
            <textarea v-model="form.description" rows="3" class="input-dark"></textarea>
          </div>

          <div class="mt-6">
            <label class="label">主封面圖片 (列表顯示用)</label>
            <input type="file" @change="handleMainCover" accept="image/*" class="file-input">
          </div>
        </div>

        <!-- 區塊 2: 變體列表 (動態新增) -->
        <div class="bg-[#1E1E1E] p-6 rounded-xl border border-gray-800 shadow-lg">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold text-green-400">2. 材質變體 (Variants)</h2>
            <button type="button" @click="addVariant" class="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2">
              + 新增規格
            </button>
          </div>

          <div class="space-y-4">
            <div v-for="(v, index) in variants" :key="v.id" class="p-4 bg-gray-900/50 rounded-lg border border-gray-700 relative group">
              
              <!-- 刪除按鈕 -->
              <button type="button" @click="removeVariant(index)" class="absolute top-2 right-2 text-gray-500 hover:text-red-500 p-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <!-- 色號 -->
                <div>
                  <label class="label text-xs">變體名稱 / 色號</label>
                  <input v-model="v.code" type="text" placeholder="例如: RO-01-淺色" required class="input-dark text-sm">
                </div>

                <!-- 變體圖 -->
                <div>
                  <label class="label text-xs">變體預覽圖 (選填)</label>
                  <input type="file" @change="(e) => handleVariantFile(e, index, 'image')" accept="image/*" class="file-input text-xs">
                  <p class="text-[10px] text-gray-500 mt-1">若未上傳，將使用主封面圖</p>
                </div>

                <!-- 檔案 -->
                <div>
                  <label class="label text-xs text-blue-300">原始檔 ZIP (必填)</label>
                  <input type="file" @change="(e) => handleVariantFile(e, index, 'zip')" accept=".zip,.rar" required class="file-input text-xs">
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 底部送出區 -->
        <div class="flex justify-end pt-4">
          <button 
            type="submit" 
            :disabled="isLoading"
            class="w-full md:w-auto px-12 bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold text-lg shadow-lg shadow-blue-900/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
          >
            <span v-if="isLoading" class="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
            {{ isLoading ? uploadStatus : '確認上架商品' }}
          </button>
        </div>

      </form>
    </div>
  </div>
</template>

<style scoped>
.label {
  @apply block text-sm text-gray-400 mb-1.5 font-medium;
}
.input-dark {
  @apply w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-600;
}
.file-input {
  @apply block w-full text-sm text-gray-400
    file:mr-4 file:py-2 file:px-4
    file:rounded-full file:border-0
    file:text-sm file:font-semibold
    file:bg-gray-800 file:text-blue-400
    hover:file:bg-gray-700
    cursor-pointer;
}
</style>