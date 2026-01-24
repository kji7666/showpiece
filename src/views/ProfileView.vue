<script setup>
import { ref, onMounted } from 'vue';
import { useUserStore } from '@/stores/user';
import { useRouter } from 'vue-router';

const userStore = useUserStore();
const router = useRouter();

// 模擬已購買的材質列表 (真實專案這裡會呼叫 API: GET /api/user/orders)
const myLibrary = ref([]);
const isLoading = ref(true);

// 模擬資料來源 (用來配對 ID)
const mockDatabase = [
  { id: 1, name: '綠蒂雅 (Lydia)', cover: 'https://images.unsplash.com/photo-1581858726768-758a59fb881b?q=80&w=400', format: '8K / JPG', date: '2024-03-15' },
  { id: 2, name: '皇家橡木 (Royal Oak)', cover: 'https://images.unsplash.com/photo-1622352822557-0a46639c4384?q=80&w=400', format: '4K / PNG', date: '2024-03-10' },
];

onMounted(async () => {
  // 模擬從後端讀取資料的延遲
  setTimeout(() => {
    // 根據 userStore 裡的 purchasedItemIds 篩選出詳細資料
    // (這裡為了展示效果，如果 store 是空的，我塞一個假資料給你看)
    if (userStore.purchasedItemIds.length === 0) {
      // 預設給一個空的，但在 UI 上為了好看，我們假設使用者如果買了 ID 1
    }

    // 簡單邏輯：只要 userStore 裡有紀錄，就從 mockDatabase 撈出來顯示
    myLibrary.value = mockDatabase.filter(item => 
      userStore.purchasedItemIds.includes(item.id)
    );
    
    isLoading.value = false;
  }, 800);
});

const goToLibrary = () => {
  router.push('/pbr');
};
</script>

<template>
  <div class="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8 bg-[#121212] text-gray-100">
    <div class="max-w-6xl mx-auto">
      
      <h1 class="text-3xl font-bold text-white mb-8 border-l-4 border-blue-600 pl-4">會員中心</h1>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        <!-- 左側：個人資料卡 -->
        <div class="lg:col-span-1">
          <div class="bg-[#1E1E1E] rounded-xl p-6 shadow-lg border border-gray-800 sticky top-24">
            <div class="flex flex-col items-center text-center mb-6">
              <div class="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-3xl font-bold text-white mb-4 shadow-xl">
                {{ userStore.user?.name?.charAt(0).toUpperCase() || 'U' }}
              </div>
              <h2 class="text-xl font-bold text-white">{{ userStore.user?.name }}</h2>
              <p class="text-gray-400 text-sm">{{ userStore.user?.email }}</p>
              
              <div class="mt-4 px-3 py-1 bg-blue-900/30 text-blue-400 text-xs rounded-full border border-blue-500/30">
                {{ userStore.user?.role === 'user' ? '標準會員' : 'VIP 會員' }}
              </div>
            </div>

            <hr class="border-gray-700 mb-6">

            <div class="space-y-4">
              <div>
                <label class="text-xs text-gray-500 uppercase font-bold">職業 / 領域</label>
                <p class="text-gray-300">{{ userStore.user?.occupation || '未設定' }}</p>
              </div>
              <div>
                <label class="text-xs text-gray-500 uppercase font-bold">所屬公司</label>
                <p class="text-gray-300">{{ userStore.user?.company || '-' }}</p>
              </div>
              <div>
                <label class="text-xs text-gray-500 uppercase font-bold">帳號建立於</label>
                <p class="text-gray-300">2024-03-20</p>
              </div>
            </div>
            
            <button class="w-full mt-8 border border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white py-2 rounded transition-colors text-sm">
              編輯資料 (Coming Soon)
            </button>
          </div>
        </div>

        <!-- 右側：已購項目 / 我的收藏 -->
        <div class="lg:col-span-2">
          <div class="bg-[#1E1E1E] rounded-xl p-6 shadow-lg border border-gray-800 min-h-[500px]">
            <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              我的素材庫 (Purchased)
            </h3>

            <!-- Loading 狀態 -->
            <div v-if="isLoading" class="flex justify-center items-center h-64 text-gray-500">
               <span class="animate-pulse">正在讀取購買紀錄...</span>
            </div>

            <!-- 空狀態 -->
            <div v-else-if="myLibrary.length === 0" class="flex flex-col justify-center items-center h-64 text-gray-500 text-center">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mb-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p class="mb-4">您目前還沒有購買任何材質</p>
              <button @click="goToLibrary" class="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-full font-bold transition-transform hover:scale-105">
                前往材質庫選購
              </button>
            </div>

            <!-- 已購列表 Grid -->
            <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div v-for="item in myLibrary" :key="item.id" class="flex bg-gray-900/50 p-3 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors">
                <img :src="item.cover" class="w-20 h-20 object-cover rounded bg-gray-800">
                <div class="ml-4 flex flex-col justify-between w-full">
                  <div>
                    <h4 class="text-white font-bold">{{ item.name }}</h4>
                    <p class="text-xs text-gray-400 mt-1">購買日期: {{ item.date }}</p>
                  </div>
                  <div class="flex justify-end">
                    <button class="text-xs flex items-center gap-1 bg-green-600/20 text-green-400 px-2 py-1 rounded hover:bg-green-600 hover:text-white transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      再次下載
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  </div>
</template>