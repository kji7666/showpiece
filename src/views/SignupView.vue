<script setup>
import { ref, reactive } from 'vue';
import { useRouter } from 'vue-router';
import { register } from '@/api/auth'; // 引入剛剛寫的 API
import { useUserStore } from '@/stores/user';

const router = useRouter();
const isLoading = ref(false);
const userStore = useUserStore();

// 表單資料模型
const form = reactive({
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  occupation: '', // 必填：職業
  company: '',    // 選填：公司
  agreeTerms: false
});

// 職業選項 (針對 PBR 網站客群設計)
const occupationOptions = [
  { value: 'architect', label: '建築師 / 室內設計師 (Architect / Interior Designer)' },
  { value: 'game_dev', label: '遊戲開發者 (Game Developer)' },
  { value: 'vfx_artist', label: '影視特效師 (VFX Artist)' },
  { value: 'student', label: '學生 / 教育用途 (Student)' },
  { value: 'hobbyist', label: '個人愛好者 (Hobbyist)' },
  { value: 'other', label: '其他 (Other)' }
];

// 處理註冊邏輯
const handleRegister = async () => {
  // 1. 基本驗證
  if (form.password !== form.confirmPassword) {
    alert('兩次輸入的密碼不一致！');
    return;
  }
  
  if (!form.agreeTerms) {
    alert('請先閱讀並同意服務條款。');
    return;
  }

  try {
    isLoading.value = true;
    
    // 2. 呼叫 API
    const response = await register({
      fullName: form.fullName,
      email: form.email,
      password: form.password, // 注意：真實專案中，這裡雖然傳明碼，但必須透過 HTTPS 加密傳輸
      occupation: form.occupation,
      company: form.company
    });

    // 3. 成功後處理
    console.log('註冊成功:', response);
    userStore.login(response.user, response.token);
    alert('註冊成功！歡迎加入 PBR Master');
    
    // 導向回首頁 (或登入頁)
    router.push('/');

  } catch (error) {
    console.error(error);
    alert(error.message || '註冊失敗，請稍後再試');
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-[#121212] flex flex-col justify-center py-12 sm:px-6 lg:px-8 pt-24">
    
    <!-- 標題區 -->
    <div class="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
      <h2 class="text-3xl font-extrabold text-white">加入 PBR Master</h2>
      <p class="mt-2 text-sm text-gray-400">
        建立帳戶以解鎖 
        <span class="text-blue-500 font-medium">8K 高畫質下載</span> 與 
        <span class="text-blue-500 font-medium">商用授權</span>
      </p>
    </div>

    <!-- 表單卡片 -->
    <div class="sm:mx-auto sm:w-full sm:max-w-md">
      <div class="bg-[#1E1E1E] py-8 px-4 shadow-2xl shadow-black/50 sm:rounded-xl sm:px-10 border border-gray-800">
        
        <form class="space-y-6" @submit.prevent="handleRegister">
          
          <!-- 姓名 -->
          <div>
            <label for="name" class="block text-sm font-medium text-gray-300">真實姓名 / 暱稱</label>
            <div class="mt-1">
              <input v-model="form.fullName" id="name" type="text" required class="input-dark" placeholder="請輸入姓名" />
            </div>
          </div>

          <!-- Email -->
          <div>
            <label for="email" class="block text-sm font-medium text-gray-300">電子郵件</label>
            <div class="mt-1">
              <input v-model="form.email" id="email" type="email" required class="input-dark" placeholder="name@company.com" />
            </div>
          </div>

          <!-- 職業 (核心需求) -->
          <div>
            <label for="occupation" class="block text-sm font-medium text-gray-300">
              您的職業 <span class="text-red-500">*</span>
            </label>
            <div class="mt-1">
              <select v-model="form.occupation" id="occupation" required class="input-dark appearance-none">
                <option value="" disabled selected>請選擇您的職業領域</option>
                <option v-for="opt in occupationOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>
          </div>

          <!-- 公司 (選填) -->
          <div>
            <label for="company" class="block text-sm font-medium text-gray-300">
              公司 / 學校名稱 <span class="text-xs text-gray-500">(選填)</span>
            </label>
            <div class="mt-1">
              <input v-model="form.company" id="company" type="text" class="input-dark" placeholder="例如: Pixar, 台大..." />
            </div>
          </div>

          <!-- 密碼區塊 -->
          <div class="grid grid-cols-1 gap-4">
            <div>
              <label for="password" class="block text-sm font-medium text-gray-300">設定密碼</label>
              <div class="mt-1">
                <input v-model="form.password" id="password" type="password" required class="input-dark" placeholder="••••••••" />
              </div>
            </div>

            <div>
              <label for="confirm-password" class="block text-sm font-medium text-gray-300">確認密碼</label>
              <div class="mt-1">
                <input v-model="form.confirmPassword" id="confirm-password" type="password" required class="input-dark" placeholder="••••••••" />
              </div>
            </div>
          </div>

          <!-- 條款同意 -->
          <div class="flex items-center">
            <input v-model="form.agreeTerms" id="terms" type="checkbox" class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-700">
            <label for="terms" class="ml-2 block text-sm text-gray-300">
              我同意 <a href="#" class="text-blue-500 hover:text-blue-400">服務條款</a> 與 <a href="#" class="text-blue-500 hover:text-blue-400">隱私權政策</a>
            </label>
          </div>

          <!-- 送出按鈕 -->
          <div>
            <button 
              type="submit" 
              :disabled="isLoading"
              class="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              <svg v-if="isLoading" class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ isLoading ? '註冊中...' : '立即註冊' }}
            </button>
          </div>
        </form>

        <!-- 底部連結 -->
        <p class="text-sm text-gray-400">
        已經有帳號了嗎？
        <!-- 將原本的 href="#" 改成 RouterLink -->
        <RouterLink to="/login" class="font-medium text-blue-500 hover:text-blue-400">
            直接登入
        </RouterLink>
        </p>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* 
  自定義 Input 樣式類別 
  使用 @apply 可以讓 HTML 更乾淨 (需搭配 PostCSS)，
  但為了方便你直接複製貼上，這裡直接寫 CSS Class。
*/
.input-dark {
  @apply block w-full px-4 py-3 bg-[#2A2A2A] border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all;
}
</style>