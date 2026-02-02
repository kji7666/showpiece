<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { updateUserPassword } from '@/api/auth';
import { useToast } from "vue-toastification";

const password = ref('');
const confirmPassword = ref('');
const isLoading = ref(false);
const router = useRouter();
const toast = useToast();

const handleUpdate = async () => {
  if (password.value.length < 6) return toast.warning('密碼長度需至少 6 碼');
  if (password.value !== confirmPassword.value) return toast.warning('兩次密碼輸入不一致');

  try {
    isLoading.value = true;
    await updateUserPassword(password.value);
    toast.success('密碼修改成功！請重新登入');
    router.push('/login');
  } catch (error) {
    toast.error('修改失敗：' + error.message);
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="min-h-screen bg-[#121212] flex flex-col justify-center py-12 sm:px-6 lg:px-8 pt-24 text-white">
    <div class="sm:mx-auto sm:w-full sm:max-w-md bg-[#1E1E1E] p-8 rounded-xl border border-gray-800 shadow-2xl">
      <h2 class="text-2xl font-bold mb-6 text-center">設定新密碼</h2>
      <form @submit.prevent="handleUpdate" class="space-y-6">
        <div>
          <label class="block text-sm text-gray-400 mb-1">新密碼</label>
          <input v-model="password" type="password" required class="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2">
        </div>
        <div>
          <label class="block text-sm text-gray-400 mb-1">確認新密碼</label>
          <input v-model="confirmPassword" type="password" required class="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2">
        </div>
        <button type="submit" :disabled="isLoading" class="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded font-bold transition-colors">
          {{ isLoading ? '更新中...' : '確認修改' }}
        </button>
      </form>
    </div>
  </div>
</template>