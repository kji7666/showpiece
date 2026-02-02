<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import PayModal from '@/components/PayModal.vue';
import { supabase } from '@/supabase'; 
import { useToast } from "vue-toastification";
import Swal from 'sweetalert2';
import { getR2DownloadLink } from '@/utils/r2';

const router = useRouter();
const userStore = useUserStore();
const toast = useToast();

const rawMaterials = ref([]); // 原始資料 (以產品 Parent 為主)
const isLoading = ref(true);     
const errorMsg = ref('');        

// --- 1. 資料讀取 (維持階層結構) ---
const fetchMaterials = async () => {
  try {
    isLoading.value = true;
    errorMsg.value = '';

    const { data, error } = await supabase
      .from('materials')
      .select(`*, material_variants (*)`)
      .order('id', { ascending: true });

    if (error) throw error;

    // 整理原始資料，保留階層結構
    rawMaterials.value = data.map(item => ({
      // 標記這是 Parent 類型
      type: 'parent', 
      id: item.id,
      brand: item.brand,
      name: item.name,
      category: item.category,
      usage: item.usage,
      size: item.size,
      phone: item.phone,
      description: item.description,
      // 圖片與價格
      image: item.cover_image, 
      price: Number(item.price),    
      isPremium: item.is_premium,
      // 變體陣列
      variants: item.material_variants ? item.material_variants.map(v => ({
        type: 'variant', // 標記這是 Variant 類型
        id: v.id,
        parentId: item.id, // 紀錄父層 ID 以便判斷權限
        parentName: item.name, // 搜尋時顯示用
        brand: item.brand,     // 搜尋時顯示用
        code: v.code,
        image: v.image || item.cover_image,
        description: item.description, // 繼承父層描述
        price: Number(item.price),     // 繼承父層價格
        isPremium: item.is_premium,    // 繼承父層權限
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

onUnmounted(() => {
  document.body.style.overflow = ''; 
});

// --- 2. 搜尋與混合顯示邏輯 (核心修改) ---
const searchQuery = ref('');

const displayItems = computed(() => {
  const term = searchQuery.value.toLowerCase().trim();

  // 情況 A：沒有搜尋 -> 顯示「產品系列 (Parents)」
  if (!term) {
    return rawMaterials.value;
  }

  // 情況 B：有搜尋 -> 攤平並顯示符合的「變體 (Variants)」
  // 我們會遍歷所有產品，把符合條件的變體抓出來變成一個大陣列
  const results = [];

  rawMaterials.value.forEach(parent => {
    // 檢查變體
    if (parent.variants && parent.variants.length > 0) {
      parent.variants.forEach(variant => {
        // 搜尋邏輯：檢查 變體代號 OR 產品名稱 OR 廠商
        const isMatch = 
          (variant.code || '').toLowerCase().includes(term) ||
          (parent.name || '').toLowerCase().includes(term) ||
          (parent.brand || '').toLowerCase().includes(term);

        if (isMatch) {
          results.push(variant); // 推入變體物件
        }
      });
    } else {
      // (選用) 如果產品沒有變體，但產品本身名稱符合，也可以推入產品
      // 但為了統一介面，這裡暫時只處理有變體的情況，或視需求開啟
    }
  });

  return results;
});

// --- 3. 彈窗邏輯 (區分 Parent 和 Variant) ---
const selectedItem = ref(null);
const isModalOpen = ref(false);
const isPayModalOpen = ref(false); 
const payTarget = ref(null);      

const openDetail = (item) => {
  selectedItem.value = item;
  isModalOpen.value = true;
  document.body.style.overflow = 'hidden';
};

const closeDetail = () => {
  isModalOpen.value = false;
  setTimeout(() => { selectedItem.value = null; }, 300); 
  document.body.style.overflow = 'auto';
};

// --- 4. 下載功能 ---
const handleDownload = (item, variantCode, resolution) => {
  // 如果是變體模式，item 就是變體本身，variantCode 可能沒傳(或直接用 item.code)
  
  if (!userStore.isLoggedIn) {
    // ... (登入檢查保持不變)
    Swal.fire({
      title: '需要會員權限',
      text: "下載此材質需要登入會員，是否前往登入？",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '前往登入',
      cancelButtonText: '稍後再說',
      background: '#1E1E1E', color: '#fff'
    }).then((result) => {
      if (result.isConfirmed) {
        closeDetail();
        router.push({ path: '/signup', query: { redirect: 'auth_required' } });
      }
    });
    return;
  }

  // 判斷權限 (注意：Parent 和 Variant 的 id 結構略有不同)
  const targetId = item.type === 'variant' ? item.parentId : item.id;
  
  const alreadyPurchased = userStore.hasPurchased(targetId);
  
  if (item.isPremium && !alreadyPurchased && item.price > 0) {
    // 這裡要傳入正確的購買對象 (通常是 Parent ID)
    payTarget.value = item.type === 'variant' ? { ...item, id: item.parentId, name: item.parentName } : item;
    isPayModalOpen.value = true;
    return;
  }

  // 取得檔案路徑
  let filePath = '';
  let finalName = '';
  let finalCode = '';

  if (item.type === 'variant') {
    // 變體模式
    filePath = item.files[resolution];
    finalName = item.parentName;
    finalCode = item.code;
  } else {
    // 產品模式 (從 variants 陣列找)
    const v = item.variants.find(v => v.code === variantCode);
    if (v) filePath = v.files[resolution];
    finalName = item.name;
    finalCode = variantCode;
  }

  startDownload(finalName, finalCode, resolution, filePath);
};

const startDownload = async (parentName, variantCode, resolution, filePath) => {
  try {
    if (!filePath) {
      toast.warning(`抱歉，目前尚未上架 [${resolution}] 解析度的檔案。`);
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { /* ... */ return; }

    toast.info('正在請求 R2 雲端下載...', { timeout: 1500 });
    const signedUrl = await getR2DownloadLink(filePath);
    toast.success(`下載開始：${parentName}-${variantCode} (${resolution})`);

    const link = document.createElement('a');
    link.href = signedUrl;
    link.setAttribute('download', `${parentName}-${variantCode}-${resolution}.zip`);
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
  Swal.fire({ title: '付款成功！', icon: 'success', background: '#1E1E1E', color: '#fff' });
};
</script>

<template>
  <div class="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8 bg-[#121212] text-gray-100">
    <!-- Header -->
    <div class="max-w-7xl mx-auto mb-10 space-y-6">
      <div class="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 class="text-3xl font-bold text-white mb-2">PBR 材質庫</h1>
          <p class="text-gray-400">精選高品質建築與室內設計材質</p>
        </div>
        <div class="relative w-full md:w-auto">
          <input v-model="searchQuery" type="text" placeholder="搜尋材質代號 (ST-01)、品名或廠商..." class="bg-gray-800 border border-gray-700 text-white px-4 py-2 pl-10 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 w-full md:w-96 transition-all">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 absolute left-3 top-2.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
      </div>
    </div>

    <!-- Loading & Error -->
    <div v-if="isLoading" class="flex flex-col items-center justify-center py-20">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
      <p class="text-gray-400">載入中...</p>
    </div>
    <div v-else-if="errorMsg" class="text-center py-20 text-red-400">
      <p>⚠️ {{ errorMsg }}</p>
      <button @click="fetchMaterials" class="mt-4 text-blue-400 underline">重試</button>
    </div>

    <!-- Grid List (會根據搜尋狀態顯示不同內容) -->
    <div v-else class="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <div v-for="item in displayItems" :key="item.type === 'parent' ? item.id : item.id" class="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 group cursor-pointer animate-fadeIn flex flex-col" @click="openDetail(item)">
        
        <!-- 圖片區塊 -->
        <div class="relative aspect-square bg-gray-50 border-b border-gray-100">
          <img 
            :src="item.image" 
            :alt="item.name || item.code" 
            class="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500" 
            @error="$event.target.src = 'https://placehold.co/600x400?text=No+Image'"
          >
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors"></div>
          
          <!-- Premium Tag -->
          <div class="absolute top-2 right-2">
             <span v-if="item.isPremium" class="bg-yellow-500 text-black text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">PREMIUM</span>
          </div>
        </div>

        <!-- 資訊區塊 (區分顯示內容) -->
        <div class="p-4 flex-1 flex flex-col">
          <!-- 如果是 Variant (搜尋結果) -->
          <template v-if="item.type === 'variant'">
            <div class="flex items-start justify-between mb-1">
              <h3 class="text-xl font-bold text-gray-900">{{ item.code }}</h3>
              <!-- <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">變體</span> -->
            </div>
            <p class="text-sm text-gray-500 mb-2">{{ item.parentName }}</p>
            <div class="mt-auto">
               <button class="w-full py-2 bg-blue-50 text-blue-600 font-bold rounded hover:bg-blue-600 hover:text-white transition-colors text-sm">
                  下載檔案
               </button>
            </div>
          </template>

          <!-- 如果是 Parent (預設列表) -->
          <template v-else>
            <div class="flex items-start justify-between mb-1">
              <h3 class="text-xl font-bold text-gray-900 truncate">{{ item.name }}</h3>
              <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{{ item.variants.length }} 色</span>
            </div>
            <p class="text-sm text-gray-500 mb-2">{{ item.category }}</p>
            <div class="mt-auto">
               <button class="w-full py-2 bg-gray-100 text-gray-600 font-bold rounded group-hover:bg-blue-600 group-hover:text-white transition-colors text-sm">
                  查看系列
               </button>
            </div>
          </template>
        </div>
      </div>

      <!-- No Results -->
      <div v-if="displayItems.length === 0" class="col-span-full py-20 text-center">
        <h3 class="text-xl font-bold text-white mb-2">找不到符合 "{{ searchQuery }}" 的材質</h3>
        <button @click="searchQuery = ''" class="text-blue-400 hover:text-blue-300 underline font-medium">清除搜尋</button>
      </div>
    </div>

    <!-- Smart Modal (根據點擊項目顯示不同介面) -->
    <div v-if="isModalOpen" class="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div class="absolute inset-0 bg-black/80 backdrop-blur-sm" @click="closeDetail"></div>
      
      <div class="relative bg-white w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col animate-fadeIn">
        <button @click="closeDetail" class="absolute top-4 right-4 p-2 bg-gray-100 hover:bg-gray-200 rounded-full z-10 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <!-- 模式 A: 搜尋到的單一變體 (Variant Mode) -->
        <div v-if="selectedItem.type === 'variant'" class="flex flex-col md:flex-row min-h-[400px]">
          <div class="md:w-1/2 bg-gray-50 p-8 flex items-center justify-center">
             <img :src="selectedItem.image" class="max-w-full max-h-[400px] object-contain shadow-md" @error="$event.target.src = 'https://placehold.co/600x400?text=No+Image'">
          </div>
          <div class="md:w-1/2 p-8 flex flex-col justify-center">
             <span class="text-green-600 font-bold tracking-wider text-sm mb-1">{{ selectedItem.brand }}</span>
             <h2 class="text-4xl font-extrabold text-gray-900 mb-2">{{ selectedItem.code }}</h2>
             <p class="text-xl text-gray-500 mb-6">{{ selectedItem.parentName }}</p>
             
             <div class="bg-gray-50 p-4 rounded-lg mb-8 text-sm text-gray-600">
                {{ selectedItem.description || '暫無描述' }}
             </div>

             <div class="grid grid-cols-1 gap-3">
                <button v-for="res in ['1K', '2K', '4K']" :key="res" @click="handleDownload(selectedItem, null, res)" class="flex items-center justify-between w-full px-6 py-3 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-gray-700 hover:text-blue-700 font-bold">
                   <span>{{ res }} Texture</span>
                   <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                </button>
             </div>
          </div>
        </div>

        <!-- 模式 B: 預設的產品系列 (Parent Mode) -->
        <div v-else>
           <div class="flex flex-col lg:flex-row border-b border-gray-200">
             <div class="lg:w-1/2 h-64 lg:h-auto bg-gray-50 flex items-center justify-center p-4">
               <img :src="selectedItem.image" class="max-w-full max-h-full object-contain" @error="$event.target.src = 'https://placehold.co/600x400?text=No+Image'">
             </div>
             <div class="lg:w-1/2 p-8 lg:p-12 text-gray-800">
               <h2 class="text-3xl font-bold text-gray-900 mb-2">{{ selectedItem.name }}</h2>
               <p class="text-green-600 font-semibold text-lg mb-4">{{ selectedItem.brand }}</p>
               <div class="space-y-2 text-base text-gray-600">
                 <p><span class="font-bold">類型：</span>{{ selectedItem.category }}</p>
                 <p><span class="font-bold">規格：</span>{{ selectedItem.size || '-' }}</p>
               </div>
               <div class="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600 leading-relaxed">{{ selectedItem.description }}</div>
             </div>
           </div>
           
           <!-- 顯示該系列的所有變體 -->
           <div class="p-8 bg-gray-50">
             <h3 class="text-xl font-bold text-gray-800 mb-6 border-l-4 border-green-500 pl-3">全系列下載 ({{ selectedItem.variants.length }}色)</h3>
             <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
               <div v-for="variant in selectedItem.variants" :key="variant.id" class="bg-white border border-gray-200 p-4 rounded-lg shadow-sm">
                 <div class="aspect-square bg-gray-200 mb-4 rounded overflow-hidden">
                   <img :src="variant.image" class="w-full h-full object-cover" @error="$event.target.src = 'https://placehold.co/400x400?text=No+Image'">
                 </div>
                 <h4 class="font-bold text-gray-800 text-center mb-4">{{ variant.code }}</h4>
                 <div class="flex justify-between gap-2">
                   <button v-for="res in ['1K', '2K', '4K']" :key="res" @click="handleDownload(selectedItem, variant.code, res)" class="flex-1 py-1 text-sm font-semibold text-blue-600 hover:text-white border border-blue-600 hover:bg-blue-600 rounded transition-colors">{{ res }}</button>
                 </div>
               </div>
             </div>
           </div>
        </div>

      </div>
    </div>

    <!-- Payment Modal -->
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