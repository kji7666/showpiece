<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import PayModal from '@/components/PayModal.vue';
import { supabase } from '@/supabase'; 
import { useToast } from "vue-toastification";
import Swal from 'sweetalert2';
// 引入 R2 工具
import { getR2DownloadLink } from '@/utils/r2';

const router = useRouter();
const userStore = useUserStore();
const toast = useToast();

const materials = ref([]);       
const isLoading = ref(true);     
const errorMsg = ref('');        

const fetchMaterials = async () => {
  try {
    isLoading.value = true;
    errorMsg.value = '';

    const { data, error } = await supabase
      .from('materials')
      .select(`*, material_variants (*)`)
      .order('id', { ascending: true });

    if (error) throw error;

    materials.value = data.map(item => ({
      id: item.id,
      brand: item.brand,
      name: item.name,
      category: item.category,
      usage: item.usage,
      size: item.size,
      phone: item.phone,
      description: item.description,
      coverImage: item.cover_image, 
      price: Number(item.price),    
      isPremium: item.is_premium,
      variants: item.material_variants ? item.material_variants.map(v => ({
        id: v.id,
        code: v.code,
        image: v.image || item.cover_image,
        files: {
          '1K': v.file_path_1k,
          '2K': v.file_path_2k,
          '4K': v.file_path_4k
        }
      })) : []
    }));

  } catch (err) {
    console.error('載入失敗:', err);
    errorMsg.value = '無法載入材質資料，請稍後再試。';
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchMaterials();
});

const searchQuery = ref('');
const selectedCategory = ref('All');
const priceFilter = ref('All'); 
const categories = ['All', '超耐磨木地板', '實木地板', '石材', '金屬', '布料'];


const filteredMaterials = computed(() => {
  return materials.value.filter(item => {
    const term = searchQuery.value.toLowerCase().trim(); // 去除前後空白並轉小寫

    // --- 1. 關鍵字搜尋 (大幅升級) ---
    
    // A. 搜尋基本欄位：品名 (Name)、廠商 (Brand)、描述 (Description)
    const matchBasicInfo = 
      (item.name || '').toLowerCase().includes(term) || 
      (item.brand || '').toLowerCase().includes(term) || 
      (item.description || '').toLowerCase().includes(term);

    // B. 搜尋產品型號 (Code)：因為型號藏在 variants 陣列裡，要深入去檢查
    // 只要該材質的「任何一個」變體代號符合搜尋關鍵字，就算符合
    const matchModelCode = item.variants && item.variants.some(v => 
      (v.code || '').toLowerCase().includes(term)
    );

    // 只要 A 或 B 其中一個符合，關鍵字搜尋就算通過
    const isKeywordMatch = matchBasicInfo || matchModelCode;


    // --- 2. 其他篩選條件 (保持不變) ---
    const matchCategory = selectedCategory.value === 'All' || item.category === selectedCategory.value;
    
    let matchPrice = true;
    if (priceFilter.value === 'Free') matchPrice = !item.isPremium;
    if (priceFilter.value === 'Premium') matchPrice = item.isPremium;

    // --- 3. 回傳總結果 ---
    return isKeywordMatch && matchCategory && matchPrice;
  });
});

const selectedMaterial = ref(null);
const isModalOpen = ref(false);
const isPayModalOpen = ref(false); 
const payTarget = ref(null);      

const openDetail = (item) => {
  selectedMaterial.value = item;
  isModalOpen.value = true;
  document.body.style.overflow = 'hidden';
};

const closeDetail = () => {
  isModalOpen.value = false;
  setTimeout(() => { selectedMaterial.value = null; }, 300); 
  document.body.style.overflow = 'auto';
};

const handleDownload = (variantCode, resolution) => {
  const item = selectedMaterial.value;

  if (!userStore.isLoggedIn) {
    Swal.fire({
      title: '需要會員權限',
      text: "下載此材質需要登入會員，是否前往登入？",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: '前往登入',
      cancelButtonText: '稍後再說',
      background: '#1E1E1E',
      color: '#fff'
    }).then((result) => {
      if (result.isConfirmed) {
        closeDetail();
        router.push({ path: '/signup', query: { redirect: 'auth_required' } });
      }
    });
    return;
  }

  const alreadyPurchased = userStore.hasPurchased(item.id);
  if (item.isPremium && !alreadyPurchased && item.price > 0) {
    payTarget.value = item;
    isPayModalOpen.value = true;
    return;
  }

  startDownload(item.name, variantCode, resolution);
};

// --- R2 下載 ---
const startDownload = async (itemName, variantCode, resolution) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('系統檢測到憑證過期，請重新登入！');
      userStore.logout(); 
      router.push('/login');
      return;
    }

    const variant = selectedMaterial.value.variants.find(v => v.code === variantCode);
    if (!variant) throw new Error('找不到變體資料');

    const filePath = variant.files[resolution];
    if (!filePath) {
      toast.warning(`抱歉，目前尚未上架 [${resolution}] 解析度的檔案。`);
      return;
    }

    toast.info('正在請求 R2 雲端下載...', { timeout: 1500 });

    // 使用 R2 工具取得連結
    const signedUrl = await getR2DownloadLink(filePath);

    toast.success(`下載開始：${itemName} (${resolution})`);

    const link = document.createElement('a');
    link.href = signedUrl;
    link.setAttribute('download', `${itemName}-${variantCode}-${resolution}.zip`);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);

  } catch (err) {
    console.error('下載失敗:', err);
    toast.error('下載失敗：R2 連線錯誤或檔案不存在。');
  }
};

const onPaymentSuccess = (itemId) => {
  userStore.addPurchase(itemId);
  isPayModalOpen.value = false;
  Swal.fire({
    title: '付款成功！',
    text: '授權已開通，您可以開始下載了。',
    icon: 'success',
    confirmButtonText: '太棒了',
    background: '#1E1E1E',
    color: '#fff'
  });
};
</script>

<template>
  <!-- Template 保持不變 (與之前版本相同) -->
  <div class="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8 bg-[#121212] text-gray-100">
    <div class="max-w-7xl mx-auto mb-10 space-y-6">
      <div class="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">PBR 材質庫</h1>
          <p class="text-gray-400">精選高品質建築與室內設計材質</p>
        </div>
        <div class="relative w-full md:w-auto">
          <input v-model="searchQuery" type="text" placeholder="搜尋品名、廠商或產品型號..." class="bg-gray-800 border border-gray-700 text-white px-4 py-2 pl-10 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-80 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 absolute left-3 top-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>
      <!-- <div class="flex flex-wrap items-center gap-4 p-4 bg-[#1E1E1E] rounded-xl border border-gray-800 shadow-md">
        <div class="flex flex-wrap gap-2 items-center">
          <span class="text-sm text-gray-500 mr-1">分類:</span>
          <button v-for="cat in categories" :key="cat" @click="selectedCategory = cat" class="px-3 py-1 text-sm rounded-full border transition-all" :class="selectedCategory === cat ? 'bg-blue-600 text-white border-blue-600' : 'text-gray-300 border-gray-600 hover:border-gray-400 hover:bg-gray-800'">{{ cat }}</button>
        </div>
        <div class="h-6 w-px bg-gray-700 hidden sm:block"></div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-gray-500">價格:</span>
          <select v-model="priceFilter" class="bg-gray-800 text-white text-sm border border-gray-600 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-gray-400">
            <option value="All">全部顯示</option>
            <option value="Free">免費 (Free)</option>
            <option value="Premium">付費 (Premium)</option>
          </select>
        </div>
      </div> -->
    </div>

    <div v-if="isLoading" class="flex flex-col items-center justify-center py-20">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
      <p class="text-gray-400">正在從雲端載入材質庫...</p>
    </div>

    <div v-else-if="errorMsg" class="text-center py-20 text-red-400">
      <p>⚠️ {{ errorMsg }}</p>
      <button @click="fetchMaterials" class="mt-4 text-blue-400 underline">重試</button>
    </div>

    <div v-else class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      <div v-for="item in filteredMaterials" :key="item.id" class="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group cursor-pointer animate-fadeIn" @click="openDetail(item)">
        <div class="relative h-64 overflow-hidden">
          <img :src="item.coverImage" :alt="item.name" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" @error="$event.target.src = 'https://placehold.co/600x400?text=No+Image'">
          <div class="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
          <div class="absolute top-3 right-3">
             <span v-if="item.isPremium" class="bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded shadow-md">PREMIUM ${{ item.price }}</span>
             <!-- <span v-else class="bg-green-600 text-white text-xs font-bold px-2 py-1 rounded shadow-md">FREE</span> -->
          </div>
        </div>
        <div class="p-6">
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-2xl font-bold text-gray-900 truncate">{{ item.name }}</h3>
            <span class="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded flex-shrink-0">PBR</span>
          </div>
          <div class="space-y-1 mb-6 text-gray-600">
            <p><span class="font-semibold text-gray-800">材質：</span> {{ item.category }}</p>
            <p><span class="font-semibold text-gray-800"></span> {{ item.usage }}</p>
          </div>
          <button class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors">
            查看詳情 / Download
          </button>
        </div>
      </div>
      <div v-if="filteredMaterials.length === 0" class="col-span-full py-20 text-center">
        <h3 class="text-xl font-bold text-white mb-2">找不到符合條件的材質</h3>
        <button @click="searchQuery = ''; selectedCategory = 'All'; priceFilter = 'All'" class="text-blue-400 hover:text-blue-300 underline font-medium">清除所有篩選</button>
      </div>
    </div>

    <div v-if="isModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="closeDetail"></div>
      <div class="relative bg-white w-full max-w-6xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col animate-fadeIn">
        <button @click="closeDetail" class="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full z-10 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <div class="flex flex-col lg:flex-row border-b border-gray-200">
          <div class="lg:w-1/2 h-64 lg:h-auto relative">
            <img :src="selectedMaterial.coverImage" class="w-full h-full object-cover" @error="$event.target.src = 'https://placehold.co/600x400?text=No+Image'">
          </div>
          <div class="lg:w-1/2 p-8 lg:p-12 text-gray-800">
            <div class="mb-6">
              <h2 class="text-3xl font-bold text-gray-900 mb-2">{{ selectedMaterial.name }}</h2>
              <div class="flex flex-wrap items-center gap-3">
                 <p class="text-green-600 font-semibold text-lg">{{ selectedMaterial.brand }}</p>
                 <div class="flex items-center gap-2">
                    <span v-if="selectedMaterial.isPremium && selectedMaterial.price === 0" class="px-3 py-1 bg-purple-100 text-purple-800 text-sm font-bold rounded-full">限時免費</span>
                    <span v-else-if="selectedMaterial.isPremium" class="px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-bold rounded-full">${{ selectedMaterial.price }} USD</span>
                    <!-- <span v-else class="px-3 py-1 bg-green-100 text-green-800 text-sm font-bold rounded-full">FREE</span> -->
                    <span v-if="userStore.hasPurchased(selectedMaterial.id)" class="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-bold rounded-full border border-blue-200 flex items-center gap-1">已購買</span>
                 </div>
              </div>
            </div>
            <div class="space-y-3 text-base">
              <div class="flex border-b border-gray-100 pb-2"><span class="w-24 font-bold text-gray-500">廠商：</span><span class="text-gray-900">{{ selectedMaterial.brand || '-' }}</span></div>
              <div class="flex border-b border-gray-100 pb-2"><span class="w-24 font-bold text-gray-500">品名：</span><span class="text-gray-900">{{ selectedMaterial.name }}</span></div>
              <div class="flex border-b border-gray-100 pb-2"><span class="w-24 font-bold text-gray-500">類型：</span><span class="text-gray-900">{{ selectedMaterial.category }}</span></div>
              <div class="flex border-b border-gray-100 pb-2"><span class="w-24 font-bold text-gray-500">規格：</span><span class="text-gray-900">{{ selectedMaterial.size || '-' }}</span></div>
              <div class="flex border-b border-gray-100 pb-2"><span class="w-24 font-bold text-gray-500">聯絡電話：</span><span class="text-gray-900">{{ selectedMaterial.phone || '-' }}</span></div>
            </div>
            <div class="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600 leading-relaxed">{{ selectedMaterial.description }}</div>
          </div>
        </div>
        <div class="p-8 bg-gray-50">
          <h3 class="text-xl font-bold text-gray-800 mb-6 border-l-4 border-green-500 pl-3">檔案下載：共 {{ selectedMaterial.variants.length }} 色</h3>
          <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            <div v-for="variant in selectedMaterial.variants" :key="variant.id" class="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
              <div class="aspect-square bg-gray-200 mb-4 rounded overflow-hidden">
                <img :src="variant.image" :alt="variant.code" class="w-full h-full object-cover" @error="$event.target.src = 'https://placehold.co/400x400?text=No+Image'">
              </div>
              <h4 class="font-bold text-gray-800 text-center mb-4">{{ variant.code }}</h4>
              <div class="flex justify-between gap-2">
                <button v-for="res in ['1K', '2K', '4K']" :key="res" @click="handleDownload(variant.code, res)" class="flex-1 py-1 text-sm font-semibold text-blue-600 hover:text-white border border-blue-600 hover:bg-blue-600 rounded transition-colors">{{ res }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <PayModal 
      :is-open="isPayModalOpen"
      :product="payTarget"
      @close="isPayModalOpen = false"
      @payment-success="onPaymentSuccess"
    />
  </div>
</template>

<style scoped>
@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
.animate-fadeIn { animation: fadeIn 0.2s ease-out; }
</style>