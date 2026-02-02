<script setup>
import { onMounted } from 'vue';
import { RouterView, useRouter } from 'vue-router';
import NavBar from './components/NavBar.vue';
import { supabase } from '@/supabase'; // 引入 supabase

const router = useRouter();

onMounted(() => {
  // 監聽 Supabase 的身份狀態變化
  supabase.auth.onAuthStateChange((event, session) => {
    
    // 🔥 關鍵：如果偵測到是「密碼救援 (PASSWORD_RECOVERY)」事件
    if (event === 'PASSWORD_RECOVERY') {
      console.log('偵測到重設密碼請求，跳轉中...');
      // 強制跳轉到重設密碼頁
      router.push('/update-password');
    }
  });
});
</script>

<template>
  <div class="min-h-screen bg-[#121212] text-gray-100 font-sans">
    <NavBar />
    <main>
      <RouterView />
    </main>
  </div>
</template>

<style>
body {
  margin: 0;
  background-color: #121212;
}
</style>