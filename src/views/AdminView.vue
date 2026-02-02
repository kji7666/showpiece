<script setup>
import { ref, reactive } from 'vue';
import { supabase } from '@/supabase';
import { useToast } from "vue-toastification";
import { uploadToR2 } from '@/utils/r2';

const toast = useToast();
const isLoading = ref(false);
const currentTab = ref('upload'); // 'upload' | 'manage'

// ==========================================
//  共用工具
// ==========================================
const uploadStatus = ref('');

const uploadToStorage = async (file, folder) => {
  if (!file) return null;

  if (file.name.endsWith('.zip') || file.name.endsWith('.rar')) {
    const loadingToast = toast.info(`正在傳輸至 R2: ${file.name}`, { timeout: false });
    try {
      const path = await uploadToR2(file, 'zips');
      toast.dismiss(loadingToast);
      return path;
    } catch (e) {
      toast.dismiss(loadingToast);
      throw e;
    }
  } 
  
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;
  const filePath = `${folder}/${fileName}`;
  
  const { error } = await supabase.storage.from('pbr-files').upload(filePath, file);
  if (error) throw error;
  return filePath;
};

// ==========================================
//  PART 1: 上架新商品 (Create)
// ==========================================
const form = reactive({
  // 修改點：category 預設為空字串，讓使用者自己填
  name: '', brand: '', category: '', price: 0, isPremium: false, description: '', size: '', phone: '', coverFile: null
});

const variants = ref([
  { id: Date.now(), code: '', imageFile: null, zipFile1k: null, zipFile2k: null, zipFile4k: null }
]);

const addVariant = () => {
  variants.value.push({ id: Date.now(), code: '', imageFile: null, zipFile1k: null, zipFile2k: null, zipFile4k: null });
};

const removeVariant = (index) => {
  if (variants.value.length > 1) {
    variants.value.splice(index, 1);
  } else {
    toast.warning('至少需要包含一個變體');
  }
};

const handleMainCover = (e) => form.coverFile = e.target.files[0];

const handleVariantFile = (e, index, type) => {
  const file = e.target.files[0];
  if (type === 'image') variants.value[index].imageFile = file;
  if (type === 'zip1k') variants.value[index].zipFile1k = file;
  if (type === 'zip2k') variants.value[index].zipFile2k = file;
  if (type === 'zip4k') variants.value[index].zipFile4k = file;
};

const handleSubmit = async () => {
  // 修改點：加入 category 的檢查
  if (!form.name || !form.coverFile || !form.category) {
    toast.warning('請填寫商品名稱、分類並上傳主封面圖');
    return;
  }
  
  for (const v of variants.value) {
    if (!v.code) return toast.warning(`請填寫變體色號`);
    if (!v.zipFile1k) return toast.warning(`變體 ${v.code} 缺少 1K 原始檔 (必填)`);
  }

  try {
    isLoading.value = true;
    
    uploadStatus.value = '上傳主封面圖...';
    const mainCoverPath = await uploadToStorage(form.coverFile, 'covers');
    const { data: { publicUrl: mainCoverUrl } } = supabase.storage.from('pbr-files').getPublicUrl(mainCoverPath);

    uploadStatus.value = '建立資料庫紀錄...';
    const { data: material, error: matError } = await supabase.from('materials').insert([{
      name: form.name, 
      brand: form.brand, 
      category: form.category, // 寫入自訂分類
      price: form.price, 
      is_premium: form.isPremium, 
      description: form.description, 
      size: form.size, 
      phone: form.phone, 
      cover_image: mainCoverUrl
    }]).select().single();

    if (matError) throw matError;

    let count = 0;
    for (const v of variants.value) {
      count++;
      uploadStatus.value = `處理變體 ${count}/${variants.value.length}...`;

      let variantImageUrl = mainCoverUrl;
      if (v.imageFile) {
        const vPath = await uploadToStorage(v.imageFile, 'covers');
        variantImageUrl = supabase.storage.from('pbr-files').getPublicUrl(vPath).data.publicUrl;
      }

      const path1k = await uploadToStorage(v.zipFile1k, 'zips');
      const path2k = await uploadToStorage(v.zipFile2k, 'zips');
      const path4k = await uploadToStorage(v.zipFile4k, 'zips');

      const { error: varError } = await supabase.from('material_variants').insert([{
        material_id: material.id,
        code: v.code,
        image: variantImageUrl,
        file_path_1k: path1k, 
        file_path_2k: path2k,
        file_path_4k: path4k
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

// ==========================================
//  PART 2: 管理列表與編輯 (Edit & Manage)
// ==========================================
const existingMaterials = ref([]);
const isFetching = ref(false);
const showEditModal = ref(false);
const editForm = reactive({});
const editVariantsList = ref([]);
const changingCoverId = ref(null);

const fetchMaterials = async () => {
  isFetching.value = true;
  const { data, error } = await supabase.from('materials').select('*').order('id', { ascending: false });
  if (error) toast.error('無法讀取列表');
  else existingMaterials.value = data;
  isFetching.value = false;
};

const handleUpdateCover = async (event, materialId) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    changingCoverId.value = materialId;
    toast.info('正在更新封面...');
    const filePath = await uploadToStorage(file, 'covers');
    const { data: { publicUrl: newUrl } } = supabase.storage.from('pbr-files').getPublicUrl(filePath);
    const { error } = await supabase.from('materials').update({ cover_image: newUrl }).eq('id', materialId);
    if (error) throw error;
    toast.success('封面已更新');
    fetchMaterials();
  } catch (error) {
    toast.error('更新失敗');
  } finally {
    changingCoverId.value = null;
  }
};

const deleteMaterial = async (id) => {
  if (!confirm('確定要刪除此商品嗎？所有的變體也會被刪除。')) return;
  try {
    const { error } = await supabase.from('materials').delete().eq('id', id);
    if (error) throw error;
    toast.success('刪除成功');
    fetchMaterials();
  } catch (error) {
    toast.error('刪除失敗');
  }
};

const openEdit = async (material) => {
  Object.assign(editForm, material);
  const { data, error } = await supabase.from('material_variants').select('*').eq('material_id', material.id).order('id', { ascending: true });
  if (error) return toast.error('讀取變體失敗');
  editVariantsList.value = data.map(v => ({ ...v, newFile1k: null, newFile2k: null, newFile4k: null }));
  showEditModal.value = true;
};

const updateMainInfo = async () => {
  try {
    // 修改點：加入 category 的更新
    const { error } = await supabase.from('materials').update({
        name: editForm.name,
        brand: editForm.brand,
        category: editForm.category, // 更新分類
        price: editForm.price,
        is_premium: editForm.is_premium,
        description: editForm.description,
        size: editForm.size,
        phone: editForm.phone
      }).eq('id', editForm.id);

    if (error) throw error;
    toast.success('主資訊更新成功');
    fetchMaterials();
  } catch (error) {
    toast.error('更新失敗');
  }
};

const updateVariant = async (variant) => {
  try {
    const loadingToast = toast.info('正在更新變體資料...', {timeout: false});
    let path1k = variant.file_path_1k;
    let path2k = variant.file_path_2k;
    let path4k = variant.file_path_4k;

    if (variant.newFile1k) path1k = await uploadToStorage(variant.newFile1k, 'zips');
    if (variant.newFile2k) path2k = await uploadToStorage(variant.newFile2k, 'zips');
    if (variant.newFile4k) path4k = await uploadToStorage(variant.newFile4k, 'zips');

    const { error } = await supabase.from('material_variants').update({
        code: variant.code,
        file_path_1k: path1k,
        file_path_2k: path2k,
        file_path_4k: path4k
      }).eq('id', variant.id);

    toast.dismiss(loadingToast);
    if (error) throw error;
    toast.success('變體更新成功！');
    variant.newFile1k = null; variant.newFile2k = null; variant.newFile4k = null;
    variant.file_path_1k = path1k; variant.file_path_2k = path2k; variant.file_path_4k = path4k;
  } catch (error) {
    console.error(error);
    toast.error('變體更新失敗');
  }
};

const deleteVariant = async (id, index) => {
  if (!confirm('確定刪除此變體？')) return;
  try {
    const { error } = await supabase.from('material_variants').delete().eq('id', id);
    if (error) throw error;
    editVariantsList.value.splice(index, 1);
    toast.success('變體已刪除');
  } catch (error) {
    toast.error('刪除失敗');
  }
};

const newVariantCode = ref('');
const addVariantInEdit = async () => {
  if(!newVariantCode.value) return toast.warning('請輸入色號');
  try {
    const { data, error } = await supabase.from('material_variants').insert([{
        material_id: editForm.id,
        code: newVariantCode.value,
        image: editForm.cover_image 
      }]).select().single();

    if(error) throw error;
    editVariantsList.value.push({ ...data, newFile1k: null, newFile2k: null, newFile4k: null });
    newVariantCode.value = '';
    toast.success('新變體已建立，請上傳檔案');
  } catch (e) {
    toast.error('新增失敗');
  }
};

const handleEditFile = (e, variant, type) => {
  const file = e.target.files[0];
  if (type === '1k') variant.newFile1k = file;
  if (type === '2k') variant.newFile2k = file;
  if (type === '4k') variant.newFile4k = file;
};

const switchTab = (tab) => {
  currentTab.value = tab;
  if (tab === 'manage') fetchMaterials();
};
</script>

<template>
  <div class="min-h-screen pt-24 pb-20 px-4 bg-[#121212] text-white">
    <div class="max-w-5xl mx-auto">
      
      <div class="flex justify-between items-center mb-8">
        <h1 class="text-3xl font-bold flex items-center gap-3">
          <span>⚙️</span> 管理員後台
        </h1>
        <div class="bg-gray-800 p-1 rounded-lg flex gap-2">
          <button @click="switchTab('upload')" class="px-4 py-2 rounded-md text-sm font-bold transition-colors" :class="currentTab === 'upload' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'">上架商品</button>
          <button @click="switchTab('manage')" class="px-4 py-2 rounded-md text-sm font-bold transition-colors" :class="currentTab === 'manage' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'">管理列表</button>
        </div>
      </div>

      <!-- TAB 1: 上架表單 -->
      <form v-if="currentTab === 'upload'" @submit.prevent="handleSubmit" class="space-y-8 animate-fadeIn">
        <div class="bg-[#1E1E1E] p-6 rounded-xl border border-gray-800 shadow-lg">
          <h2 class="text-xl font-bold mb-4 text-blue-400">1. 基本資訊</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div><label class="label">商品名稱</label><input v-model="form.name" type="text" required class="input-dark"></div>
            <div><label class="label">品牌/廠商</label><input v-model="form.brand" type="text" class="input-dark"></div>
            
            <!-- 修改點：這裡改為 input type="text" -->
            <div>
              <label class="label">分類 (自行輸入)</label>
              <input v-model="form.category" type="text" placeholder="例如：超耐磨木地板" required class="input-dark">
            </div>

            <div><label class="label">價格 (USD)</label><input v-model="form.price" type="number" class="input-dark"></div>
            <div><label class="label">規格</label><input v-model="form.size" type="text" class="input-dark"></div>
            <div><label class="label">電話</label><input v-model="form.phone" type="text" class="input-dark"></div>
          </div>
          <div class="mt-4 flex items-center gap-2">
            <input v-model="form.isPremium" type="checkbox" id="premium" class="w-5 h-5">
            <label for="premium">設為付費商品</label>
          </div>
          <div class="mt-4"><label class="label">描述</label><textarea v-model="form.description" rows="3" class="input-dark"></textarea></div>
          <div class="mt-6"><label class="label">主封面圖片</label><input type="file" @change="handleMainCover" accept="image/*" class="file-input"></div>
        </div>

        <div class="bg-[#1E1E1E] p-6 rounded-xl border border-gray-800 shadow-lg">
          <div class="flex justify-between items-center mb-6"><h2 class="text-xl font-bold text-green-400">2. 材質變體</h2><button type="button" @click="addVariant" class="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold">+ 新增規格</button></div>
          <div class="space-y-6">
            <div v-for="(v, index) in variants" :key="v.id" class="p-6 bg-gray-900/50 rounded-lg border border-gray-700 relative">
              <button type="button" @click="removeVariant(index)" class="absolute top-2 right-2 text-gray-500 hover:text-red-500 p-1">✕</button>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div><label class="label text-xs">色號</label><input v-model="v.code" type="text" required class="input-dark text-sm"></div>
                <div><label class="label text-xs">預覽圖</label><input type="file" @change="(e) => handleVariantFile(e, index, 'image')" accept="image/*" class="file-input text-xs"></div>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-black/20 p-4 rounded-lg border border-gray-800">
                <div><label class="label text-xs text-blue-300">1K ZIP</label><input type="file" @change="(e) => handleVariantFile(e, index, 'zip1k')" class="file-input text-xs"></div>
                <div><label class="label text-xs text-purple-300">2K ZIP</label><input type="file" @change="(e) => handleVariantFile(e, index, 'zip2k')" class="file-input text-xs"></div>
                <div><label class="label text-xs text-orange-300">4K ZIP</label><input type="file" @change="(e) => handleVariantFile(e, index, 'zip4k')" class="file-input text-xs"></div>
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

      <!-- TAB 2: 管理列表 -->
      <div v-if="currentTab === 'manage'" class="animate-fadeIn">
        <div v-if="isFetching" class="text-center py-10 text-gray-500">載入中...</div>
        <div v-else class="space-y-4">
          <div v-for="item in existingMaterials" :key="item.id" class="bg-[#1E1E1E] p-4 rounded-lg border border-gray-700 flex flex-col md:flex-row gap-4 items-start md:items-center">
            <div class="relative group w-full md:w-32 h-32 flex-shrink-0 bg-black rounded-lg overflow-hidden">
              <img :src="item.cover_image" class="w-full h-full object-cover">
              <div v-if="changingCoverId !== item.id" class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer">
                <span class="text-xs font-bold mb-2">更換封面</span>
                <input type="file" accept="image/*" @change="(e) => handleUpdateCover(e, item.id)" class="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
              <div v-if="changingCoverId === item.id" class="absolute inset-0 bg-black/80 flex items-center justify-center">
                <span class="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
              </div>
            </div>
            <div class="flex-1">
              <h3 class="text-xl font-bold">{{ item.name }}</h3>
              <p class="text-sm text-gray-400">{{ item.brand }} | {{ item.category }}</p>
              <div class="mt-2 flex gap-2">
                <span v-if="item.is_premium" class="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-1 rounded">${{ item.price }}</span>
                <span v-else class="text-xs bg-green-600/30 text-green-400 px-2 py-1 rounded">FREE</span>
              </div>
            </div>
            <div class="flex gap-2">
              <button @click="openEdit(item)" class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm">編輯詳情</button>
              <button @click="deleteMaterial(item.id)" class="bg-red-900/50 hover:bg-red-600 text-red-200 hover:text-white px-4 py-2 rounded text-sm">刪除</button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- 編輯 Modal -->
    <div v-if="showEditModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div class="bg-[#1E1E1E] w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl border border-gray-700 p-6 relative">
        <button @click="showEditModal = false" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">✕</button>
        
        <h2 class="text-2xl font-bold mb-6">編輯商品: {{ editForm.name }}</h2>

        <!-- A. 編輯主資訊 -->
        <div class="mb-8 border-b border-gray-700 pb-8">
          <h3 class="text-lg font-bold text-blue-400 mb-4">基本資訊</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div><label class="label">名稱</label><input v-model="editForm.name" class="input-dark"></div>
            <div><label class="label">品牌</label><input v-model="editForm.brand" class="input-dark"></div>
            
            <!-- 修改點：編輯視窗也加入分類輸入框 -->
            <div><label class="label">分類</label><input v-model="editForm.category" class="input-dark"></div>
            
            <div><label class="label">價格</label><input v-model="editForm.price" type="number" class="input-dark"></div>
            <div><label class="label">規格</label><input v-model="editForm.size" class="input-dark"></div>
            <div><label class="label">電話</label><input v-model="editForm.phone" class="input-dark"></div>
            <div class="flex items-center gap-2 mt-6">
               <input v-model="editForm.is_premium" type="checkbox" class="w-5 h-5"> <label>付費商品</label>
            </div>
          </div>
          <div class="mb-4"><label class="label">描述</label><textarea v-model="editForm.description" rows="2" class="input-dark"></textarea></div>
          <button @click="updateMainInfo" class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded text-sm font-bold">儲存基本資訊</button>
        </div>

        <!-- B. 編輯變體 -->
        <div>
          <h3 class="text-lg font-bold text-green-400 mb-4">變體管理 (Variants)</h3>
          
          <div v-for="(v, idx) in editVariantsList" :key="v.id" class="bg-black/30 p-4 rounded-lg border border-gray-700 mb-4">
            <div class="flex justify-between mb-2">
              <input v-model="v.code" class="bg-transparent border-b border-gray-500 text-white focus:border-green-500 outline-none w-1/2 font-bold" placeholder="變體色號">
              <button @click="deleteVariant(v.id, idx)" class="text-red-400 hover:text-red-200 text-xs">刪除此變體</button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
              <!-- 1K 檔案 -->
              <div>
                <label class="text-xs text-gray-400 block mb-1">1K 檔案</label>
                <div v-if="v.file_path_1k" class="text-xs text-green-400 mb-1">✓ 已有檔案</div>
                <div v-else class="text-xs text-red-400 mb-1">✕ 無檔案</div>
                <input type="file" @change="(e) => handleEditFile(e, v, '1k')" accept=".zip,.rar" class="file-input-xs">
              </div>
              <!-- 2K 檔案 -->
              <div>
                <label class="text-xs text-gray-400 block mb-1">2K 檔案</label>
                <div v-if="v.file_path_2k" class="text-xs text-green-400 mb-1">✓ 已有檔案</div>
                <div v-else class="text-xs text-gray-500 mb-1">✕ 無檔案</div>
                <input type="file" @change="(e) => handleEditFile(e, v, '2k')" accept=".zip,.rar" class="file-input-xs">
              </div>
              <!-- 4K 檔案 -->
              <div>
                <label class="text-xs text-gray-400 block mb-1">4K 檔案</label>
                <div v-if="v.file_path_4k" class="text-xs text-green-400 mb-1">✓ 已有檔案</div>
                <div v-else class="text-xs text-gray-500 mb-1">✕ 無檔案</div>
                <input type="file" @change="(e) => handleEditFile(e, v, '4k')" accept=".zip,.rar" class="file-input-xs">
              </div>
            </div>
            
            <button @click="updateVariant(v)" class="mt-3 bg-green-700/50 hover:bg-green-600 text-green-100 px-4 py-1 rounded text-xs w-full transition-colors">
              更新此變體 (儲存色號修改與新上傳檔案)
            </button>
          </div>

          <!-- 新增變體 -->
          <div class="mt-6 flex gap-2">
            <input v-model="newVariantCode" placeholder="新變體色號 (例如: RO-New)" class="input-dark w-1/2">
            <button @click="addVariantInEdit" class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm">+ 新增變體</button>
          </div>
        </div>

      </div>
    </div>

  </div>
</template>

<style scoped>
.label { @apply block text-sm text-gray-400 mb-1.5 font-medium; }
.input-dark { @apply w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-gray-600; }
.file-input { @apply block w-full text-sm text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:bg-gray-800 file:text-blue-400 hover:file:bg-gray-700 cursor-pointer; }
.file-input-xs { @apply block w-full text-[10px] text-gray-400 file:mr-1 file:py-0.5 file:px-2 file:text-[10px] file:bg-gray-800 file:text-blue-400 hover:file:bg-gray-700 cursor-pointer; }
.animate-fadeIn { animation: fadeIn 0.3s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>