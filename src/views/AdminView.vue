<script setup>
import { ref, reactive } from 'vue';
import { supabase } from '@/supabase';
import { useToast } from 'vue-toastification';
import { uploadToR2 } from '@/utils/r2';

const toast = useToast();

const isLoading = ref(false);
const currentTab = ref('upload');
const uploadStatus = ref('');

// ==========================================
// 共用工具
// ==========================================
const uploadToStorage = async (file, folder) => {
  if (!file) return null;

  const lowerName = file.name.toLowerCase();

  console.log('[uploadToStorage] selected file:', {
    name: file.name,
    type: file.type,
    size: file.size,
    folder,
  });

  const isCompressedFile =
    lowerName.endsWith('.zip') ||
    lowerName.endsWith('.rar') ||
    lowerName.endsWith('.7z') ||
    lowerName.endsWith('.tar.gz') ||
    lowerName.endsWith('.tgz');

  if (isCompressedFile) {
    const loadingToast = toast.info(`正在傳輸至 R2: ${file.name}`, {
      timeout: false,
    });

    try {
      const path = await uploadToR2(file, 'zips');

      console.log('[uploadToStorage] R2 returned path:', path);

      if (lowerName.endsWith('.rar') && !String(path).toLowerCase().endsWith('.rar')) {
        console.warn('[uploadToStorage] 警告：上傳的是 RAR，但 R2 回傳路徑不是 .rar:', path);
        toast.warning(`警告：上傳的是 RAR，但儲存路徑不是 .rar：${path}`);
      }

      toast.dismiss(loadingToast);
      return path;
    } catch (e) {
      toast.dismiss(loadingToast);
      console.error('[uploadToStorage] R2 upload failed:', e);
      throw e;
    }
  }

  const safeName = file.name
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_');

  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${safeName}`;
  const filePath = `${folder}/${fileName}`;

  const { error } = await supabase.storage
    .from('pbr-files')
    .upload(filePath, file);

  if (error) throw error;

  console.log('[uploadToStorage] Supabase storage path:', filePath);

  return filePath;
};

// ==========================================
// PART 1: 上架新商品
// ==========================================
const form = reactive({
  name: '',
  brand: '',
  category: '',
  price: 0,
  isPremium: false,
  description: '',
  size: '',
  phone: '',
  coverFile: null,
});

const variants = ref([
  {
    id: Date.now(),
    code: '',
    imageFile: null,
    zipFile1k: null,
    zipFile2k: null,
    zipFile4k: null,
  },
]);

const addVariant = () => {
  variants.value.push({
    id: Date.now() + Math.random(),
    code: '',
    imageFile: null,
    zipFile1k: null,
    zipFile2k: null,
    zipFile4k: null,
  });
};

const removeVariant = (index) => {
  if (variants.value.length > 1) {
    variants.value.splice(index, 1);
  } else {
    toast.warning('至少需要包含一個變體');
  }
};

const handleMainCover = (e) => {
  form.coverFile = e.target.files[0] || null;
};

const handleVariantFile = (e, index, type) => {
  const file = e.target.files[0];
  if (!file) return;

  if (type === 'image') variants.value[index].imageFile = file;
  if (type === 'zip1k') variants.value[index].zipFile1k = file;
  if (type === 'zip2k') variants.value[index].zipFile2k = file;
  if (type === 'zip4k') variants.value[index].zipFile4k = file;
};

const resetCreateForm = () => {
  form.name = '';
  form.brand = '';
  form.category = '';
  form.price = 0;
  form.isPremium = false;
  form.description = '';
  form.size = '';
  form.phone = '';
  form.coverFile = null;

  variants.value = [
    {
      id: Date.now(),
      code: '',
      imageFile: null,
      zipFile1k: null,
      zipFile2k: null,
      zipFile4k: null,
    },
  ];
};

const handleSubmit = async () => {
  if (!form.name || !form.coverFile || !form.category) {
    toast.warning('請填寫商品名稱、分類並上傳主封面圖');
    return;
  }

  for (const v of variants.value) {
    if (!v.code) {
      toast.warning('請填寫變體色號');
      return;
    }

    if (!v.zipFile1k) {
      toast.warning(`變體 ${v.code} 缺少 1K 原始檔，1K 為必填`);
      return;
    }
  }

  try {
    isLoading.value = true;

    uploadStatus.value = '上傳主封面圖...';
    const mainCoverPath = await uploadToStorage(form.coverFile, 'covers');

    const {
      data: { publicUrl: mainCoverUrl },
    } = supabase.storage.from('pbr-files').getPublicUrl(mainCoverPath);

    uploadStatus.value = '建立商品資料...';

    const { data: material, error: matError } = await supabase
      .from('materials')
      .insert([
        {
          name: form.name,
          brand: form.brand,
          category: form.category,
          price: Number(form.price || 0),
          is_premium: form.isPremium,
          description: form.description,
          size: form.size,
          phone: form.phone,
          cover_image: mainCoverUrl,
        },
      ])
      .select()
      .single();

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

      const { error: varError } = await supabase
        .from('material_variants')
        .insert([
          {
            material_id: material.id,
            code: v.code,
            image: variantImageUrl,
            file_path_1k: path1k,
            file_path_2k: path2k,
            file_path_4k: path4k,
          },
        ]);

      if (varError) throw varError;
    }

    toast.success('✅ 上架成功！');
    resetCreateForm();

    if (currentTab.value === 'manage') {
      fetchMaterials();
    }
  } catch (error) {
    console.error(error);
    toast.error('上架失敗：' + error.message);
  } finally {
    isLoading.value = false;
    uploadStatus.value = '';
  }
};

// ==========================================
// PART 2: 管理列表與編輯
// ==========================================
const existingMaterials = ref([]);
const isFetching = ref(false);
const showEditModal = ref(false);
const editForm = reactive({});
const editCoverPreview = ref('');
const editVariantsList = ref([]);
const changingCoverId = ref(null);

const newEditVariant = reactive({
  code: '',
  imageFile: null,
  file1k: null,
  file2k: null,
  file4k: null,
});

const resetNewEditVariant = () => {
  newEditVariant.code = '';
  newEditVariant.imageFile = null;
  newEditVariant.file1k = null;
  newEditVariant.file2k = null;
  newEditVariant.file4k = null;
};

const fetchMaterials = async () => {
  try {
    isFetching.value = true;

    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;

    existingMaterials.value = data || [];
  } catch (error) {
    console.error(error);
    toast.error('無法讀取商品列表');
  } finally {
    isFetching.value = false;
  }
};

const handleUpdateCover = async (event, materialId) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    changingCoverId.value = materialId;
    toast.info('正在更新封面...');

    const filePath = await uploadToStorage(file, 'covers');

    const {
      data: { publicUrl: newUrl },
    } = supabase.storage.from('pbr-files').getPublicUrl(filePath);

    const { error } = await supabase
      .from('materials')
      .update({ cover_image: newUrl })
      .eq('id', materialId);

    if (error) throw error;

    toast.success('封面已更新');
    fetchMaterials();
  } catch (error) {
    console.error(error);
    toast.error('更新封面失敗：' + error.message);
  } finally {
    changingCoverId.value = null;
  }
};

const deleteMaterial = async (id) => {
  if (!confirm('確定要刪除此商品嗎？所有的變體也會被刪除。')) return;

  try {
    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', id);

    if (error) throw error;

    toast.success('刪除成功');
    fetchMaterials();
  } catch (error) {
    console.error(error);
    toast.error('刪除失敗：' + error.message);
  }
};

const openEdit = async (material) => {
  try {
    Object.assign(editForm, {
      ...material,
      newCoverFile: null,
    });

    editCoverPreview.value = material.cover_image || '';
    resetNewEditVariant();

    const { data, error } = await supabase
      .from('material_variants')
      .select('*')
      .eq('material_id', material.id)
      .order('code', { ascending: true });

    if (error) throw error;

    editVariantsList.value = (data || []).map((v) => ({
      ...v,
      newImageFile: null,
      imagePreview: v.image || material.cover_image || '',
      newFile1k: null,
      newFile2k: null,
      newFile4k: null,
    }));

    showEditModal.value = true;
  } catch (error) {
    console.error(error);
    toast.error('讀取變體失敗：' + error.message);
  }
};

const closeEditModal = () => {
  showEditModal.value = false;
  resetNewEditVariant();
  editVariantsList.value = [];
  editCoverPreview.value = '';
};

const handleEditCoverFile = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  editForm.newCoverFile = file;
  editCoverPreview.value = URL.createObjectURL(file);
};

const updateMainInfo = async () => {
  try {
    let coverImageUrl = editForm.cover_image;

    if (editForm.newCoverFile) {
      toast.info('正在上傳新封面...');

      const filePath = await uploadToStorage(editForm.newCoverFile, 'covers');

      const {
        data: { publicUrl },
      } = supabase.storage.from('pbr-files').getPublicUrl(filePath);

      coverImageUrl = publicUrl;
    }

    const { error } = await supabase
      .from('materials')
      .update({
        name: editForm.name,
        brand: editForm.brand,
        category: editForm.category,
        price: Number(editForm.price || 0),
        is_premium: editForm.is_premium,
        description: editForm.description,
        size: editForm.size,
        phone: editForm.phone,
        cover_image: coverImageUrl,
      })
      .eq('id', editForm.id);

    if (error) throw error;

    editForm.cover_image = coverImageUrl;
    editForm.newCoverFile = null;
    editCoverPreview.value = coverImageUrl;

    toast.success('主資訊更新成功');
    fetchMaterials();
  } catch (error) {
    console.error(error);
    toast.error('更新失敗：' + error.message);
  }
};

const handleEditFile = (e, variant, type) => {
  const file = e.target.files[0];
  if (!file) return;

  if (type === 'image') {
    variant.newImageFile = file;
    variant.imagePreview = URL.createObjectURL(file);
  }

  if (type === '1k') variant.newFile1k = file;
  if (type === '2k') variant.newFile2k = file;
  if (type === '4k') variant.newFile4k = file;
};

const updateVariant = async (variant) => {
  try {
    const loadingToast = toast.info('正在更新變體資料...', {
      timeout: false,
    });

    let imageUrl = variant.image;
    let path1k = variant.file_path_1k;
    let path2k = variant.file_path_2k;
    let path4k = variant.file_path_4k;

    if (variant.newImageFile) {
      const imagePath = await uploadToStorage(variant.newImageFile, 'covers');

      imageUrl = supabase
        .storage
        .from('pbr-files')
        .getPublicUrl(imagePath)
        .data
        .publicUrl;
    }

    if (variant.newFile1k) path1k = await uploadToStorage(variant.newFile1k, 'zips');
    if (variant.newFile2k) path2k = await uploadToStorage(variant.newFile2k, 'zips');
    if (variant.newFile4k) path4k = await uploadToStorage(variant.newFile4k, 'zips');

    const { error } = await supabase
      .from('material_variants')
      .update({
        code: variant.code,
        image: imageUrl,
        file_path_1k: path1k,
        file_path_2k: path2k,
        file_path_4k: path4k,
      })
      .eq('id', variant.id);

    toast.dismiss(loadingToast);

    if (error) throw error;

    variant.image = imageUrl;
    variant.imagePreview = imageUrl;
    variant.file_path_1k = path1k;
    variant.file_path_2k = path2k;
    variant.file_path_4k = path4k;

    variant.newImageFile = null;
    variant.newFile1k = null;
    variant.newFile2k = null;
    variant.newFile4k = null;

    toast.success('變體更新成功！');
  } catch (error) {
    console.error(error);
    toast.error('變體更新失敗：' + error.message);
  }
};

const deleteVariant = async (id, index) => {
  if (!confirm('確定刪除此變體？')) return;

  try {
    const { error } = await supabase
      .from('material_variants')
      .delete()
      .eq('id', id);

    if (error) throw error;

    editVariantsList.value.splice(index, 1);
    toast.success('變體已刪除');
  } catch (error) {
    console.error(error);
    toast.error('刪除失敗：' + error.message);
  }
};

const handleNewEditVariantFile = (event, type) => {
  const file = event.target.files[0];
  if (!file) return;

  if (type === 'image') newEditVariant.imageFile = file;
  if (type === '1k') newEditVariant.file1k = file;
  if (type === '2k') newEditVariant.file2k = file;
  if (type === '4k') newEditVariant.file4k = file;
};

const addVariantInEdit = async () => {
  if (!newEditVariant.code.trim()) {
    toast.warning('請輸入色號');
    return;
  }

  if (!newEditVariant.file1k) {
    toast.warning('請至少上傳 1K 檔案');
    return;
  }

  try {
    const loadingToast = toast.info('正在新增變體...', {
      timeout: false,
    });

    let imageUrl = editForm.cover_image;

    if (newEditVariant.imageFile) {
      const imagePath = await uploadToStorage(newEditVariant.imageFile, 'covers');

      imageUrl = supabase
        .storage
        .from('pbr-files')
        .getPublicUrl(imagePath)
        .data
        .publicUrl;
    }

    const path1k = await uploadToStorage(newEditVariant.file1k, 'zips');
    const path2k = await uploadToStorage(newEditVariant.file2k, 'zips');
    const path4k = await uploadToStorage(newEditVariant.file4k, 'zips');

    const { data, error } = await supabase
      .from('material_variants')
      .insert([
        {
          material_id: editForm.id,
          code: newEditVariant.code.trim(),
          image: imageUrl,
          file_path_1k: path1k,
          file_path_2k: path2k,
          file_path_4k: path4k,
        },
      ])
      .select()
      .single();

    toast.dismiss(loadingToast);

    if (error) throw error;

    editVariantsList.value.push({
      ...data,
      newImageFile: null,
      imagePreview: data.image || editForm.cover_image || '',
      newFile1k: null,
      newFile2k: null,
      newFile4k: null,
    });

    resetNewEditVariant();

    toast.success('新變體已新增');
  } catch (error) {
    console.error(error);
    toast.error('新增變體失敗：' + error.message);
  }
};

const switchTab = (tab) => {
  currentTab.value = tab;
  if (tab === 'manage') fetchMaterials();
};
</script>

<template>
  <div class="min-h-screen pt-24 pb-20 px-4 bg-[#121212] text-white">
    <div class="max-w-6xl mx-auto">
      <!-- Header -->
      <div class="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-8">
        <h1 class="text-3xl font-bold flex items-center gap-3">
          <span>⚙️</span>
          管理員後台
        </h1>

        <div class="bg-gray-800 p-1 rounded-lg flex gap-2">
          <button
            @click="switchTab('upload')"
            class="px-4 py-2 rounded-md text-sm font-bold transition-colors"
            :class="currentTab === 'upload' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'"
          >
            上架商品
          </button>

          <button
            @click="switchTab('manage')"
            class="px-4 py-2 rounded-md text-sm font-bold transition-colors"
            :class="currentTab === 'manage' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'"
          >
            管理列表
          </button>
        </div>
      </div>

      <!-- TAB 1: 上架商品 -->
      <form
        v-if="currentTab === 'upload'"
        @submit.prevent="handleSubmit"
        class="space-y-8 animate-fadeIn"
      >
        <!-- 基本資訊 -->
        <div class="bg-[#1E1E1E] p-6 rounded-xl border border-gray-800 shadow-lg">
          <h2 class="text-xl font-bold mb-4 text-blue-400">
            1. 基本資訊
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="label">商品名稱</label>
              <input v-model="form.name" type="text" required class="input-dark">
            </div>

            <div>
              <label class="label">品牌 / 廠商</label>
              <input v-model="form.brand" type="text" class="input-dark">
            </div>

            <div>
              <label class="label">分類</label>
              <input
                v-model="form.category"
                type="text"
                placeholder="例如：超耐磨木地板"
                required
                class="input-dark"
              >
            </div>

            <div>
              <label class="label">價格 USD</label>
              <input v-model="form.price" type="number" min="0" class="input-dark">
            </div>

            <div>
              <label class="label">規格</label>
              <input v-model="form.size" type="text" class="input-dark">
            </div>

            <div>
              <label class="label">電話</label>
              <input v-model="form.phone" type="text" class="input-dark">
            </div>
          </div>

          <div class="mt-4 flex items-center gap-2">
            <input v-model="form.isPremium" type="checkbox" id="premium" class="w-5 h-5">
            <label for="premium">設為付費商品</label>
          </div>

          <div class="mt-4">
            <label class="label">描述</label>
            <textarea v-model="form.description" rows="3" class="input-dark"></textarea>
          </div>

          <div class="mt-6">
            <label class="label">主封面圖片</label>
            <input
              type="file"
              @change="handleMainCover"
              accept="image/*"
              class="file-input"
            >

            <p v-if="form.coverFile" class="text-xs text-green-400 mt-2">
              已選擇：{{ form.coverFile.name }}
            </p>
          </div>
        </div>

        <!-- 材質變體 -->
        <div class="bg-[#1E1E1E] p-6 rounded-xl border border-gray-800 shadow-lg">
          <div class="flex justify-between items-center mb-6">
            <h2 class="text-xl font-bold text-green-400">
              2. 材質變體
            </h2>

            <button
              type="button"
              @click="addVariant"
              class="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold"
            >
              + 新增規格
            </button>
          </div>

          <div class="space-y-6">
            <div
              v-for="(v, index) in variants"
              :key="v.id"
              class="p-6 bg-gray-900/50 rounded-lg border border-gray-700 relative"
            >
              <button
                type="button"
                @click="removeVariant(index)"
                class="absolute top-2 right-2 text-gray-500 hover:text-red-500 p-1"
              >
                ✕
              </button>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                  <label class="label text-xs">色號</label>
                  <input
                    v-model="v.code"
                    type="text"
                    required
                    placeholder="例如：TK-ED-001"
                    class="input-dark text-sm"
                  >
                </div>

                <div>
                  <label class="label text-xs">預覽圖</label>
                  <input
                    type="file"
                    @change="(e) => handleVariantFile(e, index, 'image')"
                    accept="image/*"
                    class="file-input text-xs"
                  >
                  <p v-if="v.imageFile" class="text-xs text-green-400 mt-1 truncate">
                    {{ v.imageFile.name }}
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-black/20 p-4 rounded-lg border border-gray-800">
                <div>
                  <label class="label text-xs text-blue-300">1K 檔案 ZIP / RAR</label>
                  <input
                    type="file"
                    @change="(e) => handleVariantFile(e, index, 'zip1k')"
                    accept=".zip,.rar,.7z,.tar.gz,.tgz"
                    class="file-input text-xs"
                  >
                  <p v-if="v.zipFile1k" class="text-xs text-green-400 mt-1 truncate">
                    {{ v.zipFile1k.name }}
                  </p>
                </div>

                <div>
                  <label class="label text-xs text-purple-300">2K 檔案 ZIP / RAR</label>
                  <input
                    type="file"
                    @change="(e) => handleVariantFile(e, index, 'zip2k')"
                    accept=".zip,.rar,.7z,.tar.gz,.tgz"
                    class="file-input text-xs"
                  >
                  <p v-if="v.zipFile2k" class="text-xs text-green-400 mt-1 truncate">
                    {{ v.zipFile2k.name }}
                  </p>
                </div>

                <div>
                  <label class="label text-xs text-orange-300">4K 檔案 ZIP / RAR</label>
                  <input
                    type="file"
                    @change="(e) => handleVariantFile(e, index, 'zip4k')"
                    accept=".zip,.rar,.7z,.tar.gz,.tgz"
                    class="file-input text-xs"
                  >
                  <p v-if="v.zipFile4k" class="text-xs text-green-400 mt-1 truncate">
                    {{ v.zipFile4k.name }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-end pt-4">
          <button
            type="submit"
            :disabled="isLoading"
            class="w-full md:w-auto px-12 bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-bold text-lg disabled:opacity-50"
          >
            {{ isLoading ? uploadStatus : '確認上架' }}
          </button>
        </div>
      </form>

      <!-- TAB 2: 管理列表 -->
      <div v-if="currentTab === 'manage'" class="animate-fadeIn">
        <div v-if="isFetching" class="text-center py-10 text-gray-500">
          載入中...
        </div>

        <div v-else-if="existingMaterials.length === 0" class="text-center py-16 text-gray-500">
          目前沒有商品。
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="item in existingMaterials"
            :key="item.id"
            class="bg-[#1E1E1E] p-4 rounded-lg border border-gray-700 flex flex-col md:flex-row gap-4 items-start md:items-center"
          >
            <div class="relative group w-full md:w-32 h-32 flex-shrink-0 bg-black rounded-lg overflow-hidden">
              <img
                :src="item.cover_image"
                class="w-full h-full object-cover"
                @error="$event.target.src = 'https://placehold.co/400x400?text=No+Image'"
              >

              <div
                v-if="changingCoverId !== item.id"
                class="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer"
              >
                <span class="text-xs font-bold mb-2">快速更換封面</span>
                <input
                  type="file"
                  accept="image/*"
                  @change="(e) => handleUpdateCover(e, item.id)"
                  class="absolute inset-0 opacity-0 cursor-pointer"
                >
              </div>

              <div
                v-if="changingCoverId === item.id"
                class="absolute inset-0 bg-black/80 flex items-center justify-center"
              >
                <span class="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
              </div>
            </div>

            <div class="flex-1">
              <h3 class="text-xl font-bold">
                {{ item.name }}
              </h3>

              <p class="text-sm text-gray-400">
                {{ item.brand || '-' }} | {{ item.category || '-' }}
              </p>

              <div class="mt-2 flex gap-2">
                <span
                  v-if="item.is_premium"
                  class="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-1 rounded"
                >
                  ${{ item.price }}
                </span>

                <span
                  v-else
                  class="text-xs bg-green-600/30 text-green-400 px-2 py-1 rounded"
                >
                  FREE
                </span>
              </div>
            </div>

            <div class="flex gap-2">
              <button
                @click="openEdit(item)"
                class="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm"
              >
                編輯詳情
              </button>

              <button
                @click="deleteMaterial(item.id)"
                class="bg-red-900/50 hover:bg-red-600 text-red-200 hover:text-white px-4 py-2 rounded text-sm"
              >
                刪除
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 編輯 Modal -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
      <div class="bg-[#1E1E1E] w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl border border-gray-700 p-6 relative">
        <button
          @click="closeEditModal"
          class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl"
        >
          ✕
        </button>

        <h2 class="text-2xl font-bold mb-6 pr-10">
          編輯商品：{{ editForm.name }}
        </h2>

        <!-- A. 編輯主資訊 -->
        <div class="mb-8 border-b border-gray-700 pb-8">
          <h3 class="text-lg font-bold text-blue-400 mb-4">
            基本資訊
          </h3>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- 左側：封面 -->
            <div class="lg:col-span-1">
              <label class="label">商品封面</label>

              <div class="bg-gray-900 border border-gray-700 rounded-xl p-4">
                <div class="aspect-square bg-black/40 rounded-lg overflow-hidden flex items-center justify-center mb-4">
                  <img
                    v-if="editCoverPreview"
                    :src="editCoverPreview"
                    class="w-full h-full object-contain"
                    @error="$event.target.src = 'https://placehold.co/400x400?text=No+Image'"
                  >

                  <span v-else class="text-gray-500 text-sm">
                    尚無封面
                  </span>
                </div>

                <input
                  type="file"
                  accept="image/*"
                  @change="handleEditCoverFile"
                  class="file-input text-xs"
                >

                <p v-if="editForm.newCoverFile" class="text-xs text-green-400 mt-2 truncate">
                  已選擇新封面：{{ editForm.newCoverFile.name }}
                </p>
              </div>
            </div>

            <!-- 右側：文字資訊 -->
            <div class="lg:col-span-2">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label class="label">名稱</label>
                  <input v-model="editForm.name" class="input-dark">
                </div>

                <div>
                  <label class="label">品牌</label>
                  <input v-model="editForm.brand" class="input-dark">
                </div>

                <div>
                  <label class="label">分類</label>
                  <input v-model="editForm.category" class="input-dark">
                </div>

                <div>
                  <label class="label">價格</label>
                  <input v-model="editForm.price" type="number" min="0" class="input-dark">
                </div>

                <div>
                  <label class="label">規格</label>
                  <input v-model="editForm.size" class="input-dark">
                </div>

                <div>
                  <label class="label">電話</label>
                  <input v-model="editForm.phone" class="input-dark">
                </div>

                <div class="flex items-center gap-2 mt-6">
                  <input v-model="editForm.is_premium" type="checkbox" class="w-5 h-5">
                  <label>付費商品</label>
                </div>
              </div>

              <div class="mb-4">
                <label class="label">描述</label>
                <textarea v-model="editForm.description" rows="3" class="input-dark"></textarea>
              </div>

              <button
                @click="updateMainInfo"
                class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded text-sm font-bold"
              >
                儲存基本資訊
              </button>
            </div>
          </div>
        </div>

        <!-- B. 編輯既有變體 -->
        <div>
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-bold text-green-400">
              變體管理 Variants
            </h3>
          </div>

          <div
            v-for="(v, idx) in editVariantsList"
            :key="v.id"
            class="bg-gray-900/60 p-6 rounded-xl border border-gray-700 mb-6"
          >
            <div class="flex justify-between items-start gap-4 mb-5">
              <div class="flex-1">
                <label class="label text-xs">色號</label>
                <input
                  v-model="v.code"
                  class="input-dark text-sm font-bold"
                  placeholder="例如：TK-ED-001"
                >
              </div>

              <button
                @click="deleteVariant(v.id, idx)"
                class="text-red-400 hover:text-red-200 text-xs whitespace-nowrap mt-8"
              >
                刪除此變體
              </button>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-4 gap-5">
              <!-- 預覽圖 -->
              <div>
                <label class="label text-xs">預覽圖</label>

                <div class="aspect-square bg-black/40 rounded-lg border border-gray-700 overflow-hidden flex items-center justify-center mb-3">
                  <img
                    v-if="v.imagePreview"
                    :src="v.imagePreview"
                    class="w-full h-full object-contain"
                    @error="$event.target.src = 'https://placehold.co/400x400?text=No+Image'"
                  >

                  <span v-else class="text-xs text-gray-500">
                    無預覽圖
                  </span>
                </div>

                <input
                  type="file"
                  accept="image/*"
                  @change="(e) => handleEditFile(e, v, 'image')"
                  class="file-input-xs"
                >

                <p v-if="v.newImageFile" class="text-[11px] text-green-400 mt-1 truncate">
                  {{ v.newImageFile.name }}
                </p>
              </div>

              <!-- 1K -->
              <div>
                <label class="label text-xs text-blue-300">1K 檔案</label>

                <div class="min-h-[78px] bg-black/30 border border-gray-800 rounded-lg p-3 mb-3">
                  <div v-if="v.file_path_1k" class="text-xs text-green-400 mb-1">
                    ✓ 已有檔案
                  </div>

                  <div v-else class="text-xs text-red-400 mb-1">
                    ✕ 無檔案
                  </div>

                  <p v-if="v.file_path_1k" class="text-[10px] text-gray-500 truncate">
                    {{ v.file_path_1k }}
                  </p>
                </div>

                <input
                  type="file"
                  accept=".zip,.rar,.7z,.tar.gz,.tgz"
                  @change="(e) => handleEditFile(e, v, '1k')"
                  class="file-input-xs"
                >

                <p v-if="v.newFile1k" class="text-[11px] text-green-400 mt-1 truncate">
                  新檔案：{{ v.newFile1k.name }}
                </p>
              </div>

              <!-- 2K -->
              <div>
                <label class="label text-xs text-purple-300">2K 檔案</label>

                <div class="min-h-[78px] bg-black/30 border border-gray-800 rounded-lg p-3 mb-3">
                  <div v-if="v.file_path_2k" class="text-xs text-green-400 mb-1">
                    ✓ 已有檔案
                  </div>

                  <div v-else class="text-xs text-gray-500 mb-1">
                    ✕ 無檔案
                  </div>

                  <p v-if="v.file_path_2k" class="text-[10px] text-gray-500 truncate">
                    {{ v.file_path_2k }}
                  </p>
                </div>

                <input
                  type="file"
                  accept=".zip,.rar,.7z,.tar.gz,.tgz"
                  @change="(e) => handleEditFile(e, v, '2k')"
                  class="file-input-xs"
                >

                <p v-if="v.newFile2k" class="text-[11px] text-green-400 mt-1 truncate">
                  新檔案：{{ v.newFile2k.name }}
                </p>
              </div>

              <!-- 4K -->
              <div>
                <label class="label text-xs text-orange-300">4K 檔案</label>

                <div class="min-h-[78px] bg-black/30 border border-gray-800 rounded-lg p-3 mb-3">
                  <div v-if="v.file_path_4k" class="text-xs text-green-400 mb-1">
                    ✓ 已有檔案
                  </div>

                  <div v-else class="text-xs text-gray-500 mb-1">
                    ✕ 無檔案
                  </div>

                  <p v-if="v.file_path_4k" class="text-[10px] text-gray-500 truncate">
                    {{ v.file_path_4k }}
                  </p>
                </div>

                <input
                  type="file"
                  accept=".zip,.rar,.7z,.tar.gz,.tgz"
                  @change="(e) => handleEditFile(e, v, '4k')"
                  class="file-input-xs"
                >

                <p v-if="v.newFile4k" class="text-[11px] text-green-400 mt-1 truncate">
                  新檔案：{{ v.newFile4k.name }}
                </p>
              </div>
            </div>

            <button
              @click="updateVariant(v)"
              class="mt-5 bg-green-700/70 hover:bg-green-600 text-green-100 px-4 py-2 rounded text-sm w-full transition-colors font-bold"
            >
              更新此變體
            </button>
          </div>

          <!-- C. 新增變體：完整格式 -->
          <div class="mt-8 bg-gray-900/60 border border-gray-700 rounded-xl p-6">
            <div class="flex justify-between items-center mb-6">
              <h4 class="text-lg font-bold text-green-400">
                新增變體
              </h4>
            </div>

            <div class="p-6 bg-gray-950/50 rounded-lg border border-gray-700 relative">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                <div>
                  <label class="label text-xs">色號</label>
                  <input
                    v-model="newEditVariant.code"
                    type="text"
                    placeholder="例如：TK-ED-001"
                    class="input-dark text-sm"
                  >
                </div>

                <div>
                  <label class="label text-xs">預覽圖</label>
                  <input
                    type="file"
                    accept="image/*"
                    @change="(e) => handleNewEditVariantFile(e, 'image')"
                    class="file-input text-xs"
                  >

                  <p v-if="newEditVariant.imageFile" class="text-xs text-green-400 mt-1 truncate">
                    {{ newEditVariant.imageFile.name }}
                  </p>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 bg-black/20 p-4 rounded-lg border border-gray-800">
                <div>
                  <label class="label text-xs text-blue-300">1K 檔案 ZIP / RAR</label>
                  <input
                    type="file"
                    accept=".zip,.rar,.7z,.tar.gz,.tgz"
                    @change="(e) => handleNewEditVariantFile(e, '1k')"
                    class="file-input text-xs"
                  >

                  <p v-if="newEditVariant.file1k" class="text-xs text-green-400 mt-1 truncate">
                    {{ newEditVariant.file1k.name }}
                  </p>
                </div>

                <div>
                  <label class="label text-xs text-purple-300">2K 檔案 ZIP / RAR</label>
                  <input
                    type="file"
                    accept=".zip,.rar,.7z,.tar.gz,.tgz"
                    @change="(e) => handleNewEditVariantFile(e, '2k')"
                    class="file-input text-xs"
                  >

                  <p v-if="newEditVariant.file2k" class="text-xs text-green-400 mt-1 truncate">
                    {{ newEditVariant.file2k.name }}
                  </p>
                </div>

                <div>
                  <label class="label text-xs text-orange-300">4K 檔案 ZIP / RAR</label>
                  <input
                    type="file"
                    accept=".zip,.rar,.7z,.tar.gz,.tgz"
                    @change="(e) => handleNewEditVariantFile(e, '4k')"
                    class="file-input text-xs"
                  >

                  <p v-if="newEditVariant.file4k" class="text-xs text-green-400 mt-1 truncate">
                    {{ newEditVariant.file4k.name }}
                  </p>
                </div>
              </div>

              <div class="flex justify-end mt-5">
                <button
                  type="button"
                  @click="addVariantInEdit"
                  class="bg-green-600 hover:bg-green-500 text-white px-6 py-2 rounded-lg text-sm font-bold"
                >
                  + 新增變體
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
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
  @apply block w-full text-sm text-gray-400 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:bg-gray-800 file:text-blue-400 hover:file:bg-gray-700 cursor-pointer;
}

.file-input-xs {
  @apply block w-full text-[10px] text-gray-400 file:mr-1 file:py-0.5 file:px-2 file:text-[10px] file:bg-gray-800 file:text-blue-400 hover:file:bg-gray-700 cursor-pointer;
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>