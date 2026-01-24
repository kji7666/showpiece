<script setup>
import { ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';

// 1. 初始化 Store 與 Router
const userStore = useUserStore();
const router = useRouter();

// 2. 應用程式啟動時，檢查 localStorage 是否有舊的登入紀錄
userStore.init();

// 3. 定義導覽連結 (方便未來擴充)
const navItems = [
  { name: '首頁', path: '/' },
  { name: 'PBR 材質庫', path: '/pbr' },
  { name: '加入 LINE', path: '/contact' }
];

// 4. 手機版選單開關狀態
const isMobileMenuOpen = ref(false);

// 登出處理
const handleLogout = () => {
  if (confirm('確定要登出嗎？')) {
    userStore.logout();
    isMobileMenuOpen.value = false; // 關閉手機選單
    router.push('/'); // 回首頁
  }
};
</script>

<template>
  <!-- 
    nav: 固定在頂部 (fixed top-0)
    z-50: 層級最高
    backdrop-blur: 毛玻璃特效
  -->
  <nav class="fixed top-0 left-0 right-0 z-50 bg-[#121212]/95 border-b border-gray-800 backdrop-blur-sm transition-all duration-300">
    <div class="container mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        
        <!-- ================= 左側：Logo 區域 ================= -->
        <div class="flex-shrink-0 flex items-center gap-3 cursor-pointer group" @click="router.push('/')">
          <img 
            class="h-10 w-10 rounded-lg shadow-lg shadow-blue-500/20 group-hover:shadow-blue-500/40 transition-shadow duration-300" 
            src="/icon.jpg" 
            alt="PBR Logo" 
          />
          <span class="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            嘉樂秀圖網
          </span>
        </div>

        <!-- ================= 中間：桌面版選單 (Desktop) ================= -->
        <div class="hidden md:block">
          <div class="ml-10 flex items-baseline space-x-6">
            <RouterLink 
              v-for="item in navItems" 
              :key="item.path" 
              :to="item.path"
              class="px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 border border-transparent"
              active-class="bg-gray-800 text-blue-400 border-gray-700" 
              :class="'text-gray-300 hover:bg-gray-800 hover:text-white'"
            >
              {{ item.name }}
            </RouterLink>
          </div>
        </div>

        <!-- ================= 右側：會員狀態區 (Desktop) ================= -->
        <div class="hidden md:block">
          <!-- 情況 A: 已登入 -->
          <div v-if="userStore.isLoggedIn" class="flex items-center gap-4">
            <!-- 使用者資訊 -->
            <div class="text-right hidden lg:block">
              <p class="text-xs text-gray-400">Welcome back,</p>
              <p class="text-sm font-bold text-white">{{ userStore.userName }}</p>
            </div>

            <!-- 頭像 (Avatar) -->
            <RouterLink to="/profile">
            <div class="h-9 w-9 rounded-full bg-gradient-to-tr from-blue-600 to-blue-400 flex items-center justify-center text-white font-bold shadow-lg cursor-pointer hover:ring-2 hover:ring-white transition-all">
                {{ userStore.userName.charAt(0).toUpperCase() }}
            </div>
            </RouterLink>

            <!-- 登出按鈕 -->
            <button 
              @click="handleLogout"
              class="ml-2 text-sm text-gray-400 hover:text-red-400 transition-colors border border-gray-700 hover:border-red-400 px-3 py-1.5 rounded-md"
            >
              登出
            </button>
          </div>

          <!-- 情況 B: 未登入 -->
          <div v-else>
            <RouterLink 
              to="/signup"
              class="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-full text-sm font-bold shadow-lg shadow-blue-900/40 hover:shadow-blue-600/40 transition-all duration-200 hover:-translate-y-0.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="8.5" cy="7" r="4"></circle>
                <line x1="20" y1="8" x2="20" y2="14"></line>
                <line x1="23" y1="11" x2="17" y2="11"></line>
              </svg>
              加入會員
            </RouterLink>
          </div>
        </div>

        <!-- ================= 手機版選單按鈕 (Mobile Hamburger) ================= -->
        <div class="-mr-2 flex md:hidden">
          <button 
            @click="isMobileMenuOpen = !isMobileMenuOpen"
            class="bg-gray-800 inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none"
          >
            <span class="sr-only">Open main menu</span>
            <!-- Menu Icon -->
            <svg v-if="!isMobileMenuOpen" class="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <!-- Close Icon -->
            <svg v-else class="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- ================= 手機版下拉選單 (Mobile Menu) ================= -->
    <div v-show="isMobileMenuOpen" class="md:hidden border-t border-gray-800 bg-[#121212]">
      <div class="px-2 pt-2 pb-3 space-y-1 sm:px-3">
        <RouterLink 
          v-for="item in navItems" 
          :key="item.path" 
          :to="item.path"
          @click="isMobileMenuOpen = false"
          class="block px-3 py-2 rounded-md text-base font-medium text-gray-300 hover:text-white hover:bg-gray-700"
          active-class="bg-gray-800 text-blue-400"
        >
          {{ item.name }}
        </RouterLink>
      </div>

      <!-- 手機版會員區 -->
      <div class="pt-4 pb-4 border-t border-gray-700">
        <div v-if="userStore.isLoggedIn">
          <div class="flex items-center px-5">
            <div class="flex-shrink-0">
              <div class="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
                {{ userStore.userName.charAt(0).toUpperCase() }}
              </div>
            </div>
            <div class="ml-3">
              <div class="text-base font-medium leading-none text-white">{{ userStore.userName }}</div>
              <div class="text-sm font-medium leading-none text-gray-400 mt-1">已登入會員</div>
            </div>
          </div>
          <div class="mt-3 px-2 space-y-1">
            <button 
              @click="handleLogout"
              class="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-400 hover:text-white hover:bg-gray-700"
            >
              登出帳號
            </button>
          </div>
        </div>
        
        <div v-else class="px-5">
           <RouterLink 
              to="/signup"
              @click="isMobileMenuOpen = false"
              class="block w-full text-center bg-blue-600 text-white px-4 py-3 rounded-lg font-bold shadow-lg"
            >
              加入會員
            </RouterLink>
        </div>
      </div>
    </div>
  </nav>
  
  <!-- 佔位區塊：防止內容被 fixed header 擋住 -->
  <div class="h-16"></div>
</template>