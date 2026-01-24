<script setup>
// 這裡目前不需要額外的 script 邏輯
</script>

<template>
  <div class="min-h-screen pt-24 pb-20 px-4 bg-[#121212] text-white flex items-center justify-center">
    
    <!-- 這裡直接放入原本設計好的 LINE 區塊，稍微調整容器寬度 -->
    <div class="w-full max-w-5xl">
      
      <div class="flex flex-col md:flex-row items-center justify-center gap-12 bg-[#1E1E1E] rounded-3xl p-8 md:p-16 border border-gray-800 shadow-2xl">
          
        <!-- 左側：QR Code 圖片 -->
        <div class="flex flex-col items-center bg-white p-4 rounded-xl shadow-lg transform hover:scale-105 transition-transform duration-300">
          <!-- 請確保圖片路徑正確 -->
          <img src="/line-qr.png" alt="LINE QR Code" class="w-64 h-64 object-contain">
          <p class="mt-3 text-gray-800 font-bold text-xl tracking-wider">ID: @482wjzon</p>
        </div>

        <!-- 右側：文字說明 -->
        <div class="text-center md:text-left max-w-xl">
          <h1 class="text-3xl md:text-5xl font-bold text-white mb-8 flex items-center justify-center md:justify-start gap-4">
            <span class="text-[#06C755]">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" class="bi bi-line" viewBox="0 0 16 16">
                <path d="M8 0c4.411 0 8 2.912 8 6.492 0 1.433-.555 2.723-1.715 3.991.167.54.977 1.02.977 1.02 0 0-1.399.083-2.399-.836C12.555 12.37 10.415 13 8 13c-4.411 0-8-2.912-8-6.492C0 2.912 3.589 0 8 0z"/>
              </svg>
            </span>
            加入 LINE 官方帳號
          </h1>
          
          <p class="text-gray-300 text-xl mb-8 leading-relaxed">
            親愛的使用者您好！<br>
            加入我們的官網您能 <span class="text-[#06C755] font-bold">搶先下載</span> 最新的 PBR 檔案！
          </p>

          <div class="space-y-6 text-gray-400 text-lg">
            <div class="flex gap-4">
              <span class="text-[#06C755] mt-1 shrink-0">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              </span>
              <p><strong class="text-white">搶先下載：</strong> 每當有新的 PBR 檔案上架，我們會第一時間在 LINE 發布，讓您比別人更快一步！</p>
            </div>
            <div class="flex gap-4">
              <span class="text-[#06C755] mt-1 shrink-0">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
              </span>
              <p><strong class="text-white">即時通知：</strong> 掌握網站最新動態、重要更新與限時活動，不再錯過任何好康。</p>
            </div>
          </div>

          <div class="mt-10">
            <a href="https://line.me/ti/p/@482wjzon" target="_blank" class="inline-block bg-[#06C755] hover:bg-[#05b64d] text-white font-bold py-4 px-10 rounded-full shadow-lg shadow-green-900/50 transition-all hover:-translate-y-1 text-lg">
              立即點擊加入
            </a>
            <p class="mt-4 text-sm text-gray-500">或是拿起手機掃描左側 QR Code</p>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>