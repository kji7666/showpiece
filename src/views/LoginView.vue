<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { login, sendResetEmail } from '@/api/auth';
import { useToast } from "vue-toastification";
import Swal from 'sweetalert2';

const router = useRouter();
const userStore = useUserStore();
const toast = useToast();
const isLoading = ref(false);

const form = reactive({
  email: '',
  password: ''
});

// --- 處理登入 ---
const handleLogin = async () => {
  if (!form.email || !form.password) {
      toast.warning("請填寫 Email 與密碼");
      return;
  }

  try {
    isLoading.value = true;
    
    // 呼叫真實登入 API
    const response = await login({
      email: form.email,
      password: form.password
    });

    // 登入成功
    console.log('登入成功:', response);
    userStore.login(response.user, response.token);
    toast.success(`歡迎回來，${response.user.name}！`);
    
    router.push('/');

  } catch (error) {
    toast.error(error.message || "登入失敗，請檢查帳號密碼");
  } finally {
    isLoading.value = false;
  }
};

// --- 處理忘記密碼 ---
const handleForgotPassword = async () => {
  const { value: email } = await Swal.fire({
    title: '重設密碼',
    input: 'email',
    inputLabel: '請輸入您的註冊 Email',
    inputPlaceholder: 'name@example.com',
    showCancelButton: true,
    confirmButtonText: '發送重設信',
    cancelButtonText: '取消',
    background: '#1E1E1E',
    color: '#fff',
    customClass: { input: 'text-black' }
  });

  if (email) {
    try {
      await sendResetEmail(email);
      Swal.fire({
        icon: 'success',
        title: '已發送！',
        text: '請檢查您的信箱，點擊信中連結來設定新密碼。',
        background: '#1E1E1E',
        color: '#fff'
      });
    } catch (error) {
      toast.error('發送失敗：' + error.message);
    }
  }
};
</script>

<template>
  <div class="min-h-screen bg-[#121212] flex flex-col justify-center py-12 sm:px-6 lg:px-8 pt-24">
    
    <div class="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
      <h2 class="text-3xl font-extrabold text-white">歡迎回來</h2>
      <p class="mt-2 text-sm text-gray-400">
        登入您的帳戶
      </p>
    </div>

    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-[#1E1E1E] py-8 px-4 shadow-2xl shadow-black/50 sm:rounded-xl sm:px-10 border border-gray-800">
        
        <form class="space-y-6" @submit.prevent="handleLogin">
          
          <!-- Email 輸入框 -->
          <div>
            <label for="email" class="block text-sm font-medium text-gray-300">電子郵件</label>
            <div class="mt-1">
              <input v-model="form.email" id="email" type="email" required class="input-dark" placeholder="name@company.com" />
            </div>
          </div>

          <!-- 密碼輸入框 (這裡之前不見了，現在補回來) -->
          <div>
            <div class="flex justify-between items-center mb-1">
               <label for="password" class="block text-sm font-medium text-gray-300">密碼</label>
               <a href="#" @click.prevent="handleForgotPassword" class="text-xs text-blue-500 hover:text-blue-400">忘記密碼?</a>
            </div>
            <div class="mt-1">
              <input v-model="form.password" id="password" type="password" required class="input-dark" placeholder="••••••••" />
            </div>
          </div>

          <!-- 登入按鈕 -->
          <div>
            <button 
              type="submit" 
              :disabled="isLoading"
              class="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <svg v-if="isLoading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ isLoading ? '登入中...' : '登入' }}
            </button>
          </div>
        </form>

        <div class="mt-6 text-center">
          <p class="text-sm text-gray-400">
            還沒有帳號？
            <RouterLink to="/signup" class="font-medium text-blue-500 hover:text-blue-400">
              免費註冊
            </RouterLink>
          </p>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
.input-dark {
  @apply block w-full px-4 py-3 bg-[#2A2A2A] border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all;
}
</style>