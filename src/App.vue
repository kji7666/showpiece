<script setup>
import { RouterView } from 'vue-router'
import NavBar from './components/NavBar.vue'
</script>

<template>
  <!-- 背景色設定為深灰 (模擬 3D 軟體介面風格) -->
  <div class="min-h-screen bg-[#121212] text-gray-100 font-sans">
    
    <!-- 導覽列放在最上方 -->
    <NavBar />

    <!-- 頁面內容顯示區 -->
    <main>
      <RouterView />
    </main>

  </div>
</template>

<style>
/* 全域樣式設定 (可選) */
body {
  margin: 0;
  background-color: #121212; /* 確保延伸到視窗外也是黑色 */
}
</style>