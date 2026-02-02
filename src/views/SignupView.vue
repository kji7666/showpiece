<script setup>
import { ref, reactive, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useUserStore } from '@/stores/user';
import { register } from '@/api/auth';
import { useToast } from "vue-toastification";
import Swal from 'sweetalert2';

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const toast = useToast();
const isLoading = ref(false);

// 1. 新增：手動輸入職業的變數
const customOccupation = ref('');

const form = reactive({
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  occupation: '',
  company: '',
  agreeTerms: false
});

const occupationOptions = [
  { value: 'architect', label: '建築師 / 室內設計師 (Architect / Interior Designer)' },
  { value: 'game_dev', label: '遊戲開發者 (Game Developer)' },
  { value: 'vfx_artist', label: '影視特效師 (VFX Artist)' },
  { value: 'student', label: '學生 / 教育用途 (Student)' },
  { value: 'hobbyist', label: '個人愛好者 (Hobbyist)' },
  { value: 'other', label: '其他 (Other)' }
];

// --- 檢查是否被踢過來的 ---
onMounted(() => {
  if (route.query.redirect === 'auth_required') {
    toast.warning('該頁面需要會員權限，請先註冊或登入。');
  }
});

// --- 處理註冊 ---
const handleRegister = async () => {
  // 驗證
  if (form.password !== form.confirmPassword) {
    toast.warning('兩次輸入的密碼不一致！');
    return;
  }
  
  if (!form.agreeTerms) {
    toast.warning('請先閱讀並同意服務條款。');
    return;
  }

  // 檢查：如果選了"其他"，必須填寫內容
  if (form.occupation === 'other' && !customOccupation.value.trim()) {
    toast.warning('請輸入您的職業名稱');
    return;
  }

  // 決定最終要送出的職業名稱
  const finalOccupation = form.occupation === 'other' 
    ? customOccupation.value 
    : form.occupation;

  try {
    isLoading.value = true;
    
    // 呼叫 API
    const response = await register({
      fullName: form.fullName,
      email: form.email,
      password: form.password,
      occupation: finalOccupation, // 使用處理過的值
      company: form.company
    });

    // 註冊成功直接登入
    console.log('註冊成功:', response);
    userStore.login(response.user, response.token);

    toast.success(`註冊成功！歡迎加入，${response.user.name || 'User'}。`);
    
    router.push('/');

  } catch (error) {
    console.error(error);
    toast.error(error.message || '註冊失敗，請稍後再試');
  } finally {
    isLoading.value = false;
  }
};

// --- 顯示條款彈窗 ---
const showTerms = () => {
  Swal.fire({
    title: '服務條款 (Terms of Service)',
    html: `
      <div style="text-align: left; font-size: 0.9rem; line-height: 1.6; color: #ccc; max-height: 300px; overflow-y: auto;">
        <p>歡迎使用 PBR Master（以下簡稱本服務）。使用本服務即代表您同意以下條款：</p>
        <br>
        <h4>1. 服務內容</h4>
        <p>本服務提供數位 PBR 材質檔案下載。我們保留隨時修改、暫停或終止服務的權利。</p>
        <h4>2. 帳號安全</h4>
        <p>您有責任維護帳號密碼的安全。任何透過您帳號進行的活動，您需負完全責任。</p>
        <h4>3. 授權與使用</h4>
        <p>付費會員下載之檔案可用於個人或商業專案。但<strong>嚴禁將原始檔案進行轉售、分享或建立類似的素材庫網站</strong>。</p>
      </div>
    `,
    icon: 'info',
    confirmButtonText: '我同意',
    background: '#1E1E1E',
    color: '#fff',
    width: '600px'
  });
};

const showPrivacy = () => {
  Swal.fire({
    title: '隱私權政策 (Privacy Policy)',
    html: `
      <div style="text-align: left; font-size: 0.9rem; line-height: 1.6; color: #ccc; max-height: 300px; overflow-y: auto;">
        <p>我們非常重視您的隱私，以下是我們如何處理您的資料：</p>
        <br>
        <h4>1. 資料收集</h4>
        <p>我們僅收集運作所需的必要資料：Email、密碼（加密儲存）、職業類別及購買紀錄。</p>
        <h4>2. 資料用途</h4>
        <p>您的資料僅用於會員驗證、訂單處理及發送重要系統通知。</p>
      </div>
    `,
    icon: 'question',
    confirmButtonText: '我了解',
    background: '#1E1E1E',
    color: '#fff',
    width: '600px'
  });
};
</script>

<template>
  <div class="min-h-screen bg-[#121212] flex flex-col justify-center py-12 sm:px-6 lg:px-8 pt-24">
    
    <div class="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
      <h2 class="text-3xl font-extrabold text-white">加入 PBR Master</h2>
      <p class="mt-2 text-sm text-gray-400">
        建立帳戶以解鎖 
        <span class="text-blue-500 font-medium">8K 高畫質下載</span> 與 
        <span class="text-blue-500 font-medium">商用授權</span>
      </p>
    </div>

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

            <!-- 自訂職業輸入框 (當選擇 Other 時出現) -->
            <div v-if="form.occupation === 'other'" class="mt-3 animate-fadeIn">
              <label for="custom-occupation" class="block text-xs text-blue-400 mb-1">
                請輸入您的職業名稱：
              </label>
              <input 
                v-model="customOccupation" 
                id="custom-occupation" 
                type="text" 
                class="input-dark bg-gray-800 border-blue-500/50" 
                placeholder="例如: 3D模型師、策展人..." 
                required
              />
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
              我同意 
              <a href="#" @click.prevent="showTerms" class="text-blue-500 hover:text-blue-400 font-medium">服務條款</a> 
              與 
              <a href="#" @click.prevent="showPrivacy" class="text-blue-500 hover:text-blue-400 font-medium">隱私權政策</a>
            </label>
          </div>

          <!-- 送出按鈕 -->
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
              {{ isLoading ? '註冊中...' : '立即註冊' }}
            </button>
          </div>
        </form>

        <div class="mt-6 text-center">
          <p class="text-sm text-gray-400">
            已經有帳號了嗎？
            <RouterLink to="/login" class="font-medium text-blue-500 hover:text-blue-400">
              直接登入
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

/* 輸入框淡入動畫 */
.animate-fadeIn {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-5px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>