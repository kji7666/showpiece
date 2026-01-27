<script setup>
import { ref, reactive } from 'vue';
import { supabase } from '@/supabase';
import { useToast } from "vue-toastification";
import { uploadToR2 } from '@/utils/r2';

const toast = useToast();
const isLoading = ref(false);
const uploadStatus = ref('');

// --- 主材質資訊 ---
const form = reactive({
  name: '',
  brand: '',
  category: '超耐磨木地板',
  price: 0,
  isPremium: false,
  description: '',
  coverFile: null
});

// --- 變體列表 (結構更新：包含三個 ZIP 欄位) ---
const variants = ref([
  { 
    id: Date.now(), 
    code: '', 
    imageFile: null, 
    zipFile1k: null, 
    zipFile2k: null, 
    zipFile4k: null 
  }
]);

const addVariant = () => {
  variants.value.push({ 
    id: Date.now(), 
    code: '', 
    imageFile: null, 
    zipFile1k: null, 
    zipFile2k: null, 
    zipFile4k: null 
  });
};

const removeVariant = (index) => {
  if (variants.value.length > 1) {
    variants.value.splice(index, 1);
  } else {
    toast.warning('至少需要包含一個變體');
  }
};

const handleMainCover = (event) => {
  form.coverFile = event.target.files[0];
};

// 更新檔案處理邏輯，支援不同解析度
const handleVariantFile = (event, index, type) => {
  const file = event.target.files[0];
  if (type === 'image') variants.value[index].imageFile = file;
  if (type === 'zip1k') variants.value[index].zipFile1k = file;
  if (type === 'zip2k') variants.value[index].zipFile2k = file;
  if (type === 'zip4k') variants.value[index].zipFile4k = file;
};

// 上傳邏輯 (R2/Supabase 混合)
const uploadToStorage = async (file, folder) => {
  if (!file) return null;

  // ZIP 檔 -> R2
  if (file.name.endsWith('.zip') || file.name.endsWith('.rar')) {
    uploadStatus.value = `上傳中 (${file.name})...`;
    return await uploadToR2(file, 'zips');
  } 
  
  // 圖片 -> Supabase
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;
  const filePath = `${folder}/${fileName}`;
  const { error } = await supabase.storage.from('pbr-files').upload(filePath, file);
  if (error) throw error;
  return filePath;
};

const handleSubmit = async () => {
  if (!form.name || !form.coverFile) {
    toast.warning('請填寫商品名稱並上傳主封面圖');
    return;
  }
  
  // 檢查變體：至少要有一個 1K 檔案
  for (const v of variants.value) {
    if (!v.code) {
      toast.warning(`請填寫變體色號`);
      return;
    }
    // 這裡我們假設 1K 是必填，2K/4K 是選填
    if (!v.zipFile1k) {
      toast.warning(`變體 ${v.code} 缺少 1K 原始檔 (必填)`);
      return;
    }
  }

  try {
    isLoading.value = true;
    
    // 1. 上傳主封面
    uploadStatus.value = '處理主封面圖...';
    const mainCoverPath = await uploadToStorage(form.coverFile, 'covers');
    const { data: { publicUrl: mainCoverUrl } } = supabase.storage.from('pbr-files').getPublicUrl(mainCoverPath);

    // 2. 建立主資料
    uploadStatus.value = '建立資料庫紀錄...';
    const { data: material, error: matError } = await supabase
      .from('materials')
      .insert([{
        name: form.name,
        brand: form.brand,
        category: form.category,
        price: form.price,
        is_premium: form.isPremium,
        description: form.description,
        cover_image: mainCoverUrl
      }])
      .select()
      .single();

    if (matError) throw matError;

    // 3. 處理變體 (多檔案上傳)
    let count = 0;
    for (const v of variants.value) {
      count++;
      uploadStatus.value = `處理變體 ${count}/${variants.value.length}...`;

      // 變體圖
      let variantImageUrl = mainCoverUrl;
      if (v.imageFile) {
        const vPath = await uploadToStorage(v.imageFile, 'covers');
        variantImageUrl = supabase.storage.from('pbr-files').getPublicUrl(vPath).data.publicUrl;
      }

      // 分別上傳 1K, 2K, 4K (如果有的話)
      const path1k = await uploadToStorage(v.zipFile1k, 'zips');
      const path2k = await uploadToStorage(v.zipFile2k, 'zips');
      const path4k = await uploadToStorage(v.zipFile4k, 'zips');

      const { error: varError } = await supabase
        .from('material_variants')
        .insert([{
          material_id: material.id,
          code: v.code,
          image: variantImageUrl,
          file_path_1k: path1k, // 必填
          file_path_2k: path2k, // 選填 (null)
          file_path_4k: path4k  // 選填 (null)
        }]);

      if (varError) throw varError;
    }

    toast.success('✅ 上架成功！');
    setTimeout(() => window.location.reload(), 1500);

  } catch (error) {
    console.error(error);
    toast.error('上架失敗：' + error.message);
  } finally {
    isLoading.value = false;
    uploadStatus.value = '';
  }
};
</script>

<template>
  <div class="min-h-screen pt-24 pb-20 px-4 bg-[#121212] text-white">
    <div class="max-w-5xl mx-auto">
      <h1 class="text-3xl font-bold mb-8 flex items-center gap-3"><span>📦</span> 管理員後台：上架新材質</h1>

      <form @submit.prevent="handleSubmit" class="space-y-8">
        <!-- 區塊 1: 基本資訊 (保持不變) -->
        <div class="bg-[#1E1E1E] p-6 rounded-xl border border-gray-800 shadow-lg">
          <h2 class="text-xl font-bold mb-4 text-blue-400">1. 基本資訊</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="label">商品名稱</label>
              <input v-model="form.name" type="text" required class="input-dark">
            </div>
            <div>
              <label class="label">品牌/廠商</label>
              <input v-model="form.brand" type="text" class="input-dark">
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
            <input v-model="form.isPremium" type="checkbox" id="premium" class="w-5 h-5">
            <label for="premium">設為付費商品 (Premium)</label>
          </div>
          <div class="mt-4">
            <label class="label">商品描述</label>
            <textarea v-model="form.description" rows="3" class="input-dark"></textarea>
          </div>
          <div class="mt-6">
            <label class="label">主封面圖片</label>
            <input type="file" @change="handleMainCover" accept="image/*" class="file-input">
          </div>
        </div>

        <!-- 區塊 2: 變體列表 (重點修改：三個 ZIP 欄位) -->
        <div class="bg-[#1E1E1E] p-6 rounded-xl border border-gray-800 shadow-lg">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold text-green-400">2. 材質變體 (Variants)</h2>
            <button type="button" @click="addVariant" class="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
              + 新增規格
            </button>
          </div>

          <div class="space-y-6">
            <div v-for="(v, index) in variants" :key="v.id" class="p-6 bg-gray-900/50 rounded-lg border border-gray-700 relative">
              <button type="button" @click="removeVariant(index)" class="absolute top-2 right-2 text-gray-500 hover:text-red-500 p-1">✕</button>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                  <label class="label text-xs">變體名稱 / 色號</label>
                  <input v-model="v.code" type="text" placeholder="例如: RO-01-淺色" required class="input-dark text-sm">
                </div>
                <div>
                  <label class="label text-xs">變體預覽圖 (選填)</label>
                  <input type="file" @change="(e) => handleVariantFile(e, index, 'image')" accept="image/*" class="file-input text-xs">
                </div>
              </div>

              <!-- 解析度上傳區 (Grid) -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-black/20 p-4 rounded-lg border border-gray-800">
                
                <div>
                  <label class="label text-xs text-blue-300">1K 解析度 ZIP <span class="text-red-500">*</span></label>
                  <input type="file" @change="(e) => handleVariantFile(e, index, 'zip1k')" accept=".zip,.rar" class="file-input text-xs">
                </div>

                <div>
                  <label class="label text-xs text-purple-300">2K 解析度 ZIP (選填)</label>
                  <input type="file" @change="(e) => handleVariantFile(e, index, 'zip2k')" accept=".zip,.rar" class="file-input text-xs">
                </div>

                <div>
                  <label class="label text-xs text-orange-300">4K 解析度 ZIP (選填)</label>
                  <input type="file" @change="(e) => handleVariantFile(e, index, 'zip4k')" accept=".zip,.rar" class="file-input text-xs">
                </div>

              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end pt-4">
          <button type="submit" :disabled="isLoading" class="w-full md:w-auto px-12 bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold text-lg disabled:opacity-50">
            {{ isLoading ? uploadStatus : '確認上架' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
.label { @apply block text-sm text-gray-400 mb-1.5 font-medium; }
.input-dark { @apply w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500; }
.file-input { @apply block w-full text-sm text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:bg-gray-800 file:text-blue-400 hover:file:bg-gray-700 cursor-pointer; }
</style>