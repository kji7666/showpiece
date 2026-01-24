<script setup>
import { ref, reactive } from 'vue';
import { processPayment } from '@/api/payment';

const props = defineProps({
  isOpen: Boolean,
  product: Object // 傳入要買的材質物件
});

const emit = defineEmits(['close', 'payment-success']);

const isLoading = ref(false);
const form = reactive({
  cardNumber: '',
  expiry: '',
  cvc: '',
  holderName: ''
});

// 處理付款送出
const handleSubmit = async () => {
  try {
    isLoading.value = true;
    
    // 呼叫模擬 API
    const result = await processPayment({
      productId: props.product.id,
      ...form
    });

    // 付款成功
    alert(`付款成功！交易序號: ${result.transactionId}`);
    emit('payment-success', props.product.id);
    emit('close'); // 關閉視窗
    
    // 清空表單
    form.cardNumber = '';
    form.expiry = '';
    form.cvc = '';

  } catch (error) {
    alert('付款失敗: ' + error.message);
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-[200] flex items-center justify-center p-4">
    <!-- 背景遮罩 -->
    <div class="absolute inset-0 bg-black/90 backdrop-blur-sm" @click="$emit('close')"></div>

    <!-- 付款卡片 -->
    <div class="relative bg-[#1E1E1E] w-full max-w-md rounded-xl shadow-2xl border border-gray-700 overflow-hidden animate-fadeIn">
      
      <!-- Header -->
      <div class="bg-gray-800 px-6 py-4 border-b border-gray-700 flex justify-between items-center">
        <h3 class="text-white font-bold text-lg">安全結帳</h3>
        <button @click="$emit('close')" class="text-gray-400 hover:text-white">✕</button>
      </div>

      <div class="p-6">
        <!-- 商品摘要 -->
        <div class="flex gap-4 mb-6 bg-gray-900/50 p-3 rounded-lg border border-gray-700/50">
          <img :src="product?.coverImage" class="w-16 h-16 object-cover rounded bg-gray-700">
          <div>
            <p class="text-gray-400 text-xs uppercase">購買項目</p>
            <h4 class="text-white font-bold">{{ product?.name }}</h4>
            <p class="text-blue-400 font-bold text-lg">${{ product?.price }} USD</p>
          </div>
        </div>

        <!-- 信用卡表單 -->
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <label class="block text-gray-400 text-xs mb-1">持卡人姓名</label>
            <input v-model="form.holderName" type="text" placeholder="LEE TA MING" required class="input-dark">
          </div>
          
          <div>
            <label class="block text-gray-400 text-xs mb-1">信用卡號碼</label>
            <input v-model="form.cardNumber" type="text" placeholder="0000 0000 0000 0000" maxlength="19" required class="input-dark">
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-gray-400 text-xs mb-1">有效期限 (MM/YY)</label>
              <input v-model="form.expiry" type="text" placeholder="12/26" maxlength="5" required class="input-dark">
            </div>
            <div>
              <label class="block text-gray-400 text-xs mb-1">CVC / CVV</label>
              <input v-model="form.cvc" type="text" placeholder="123" maxlength="3" required class="input-dark">
            </div>
          </div>

          <!-- 付款按鈕 -->
          <button 
            type="submit" 
            :disabled="isLoading"
            class="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <span v-if="isLoading" class="animate-spin">↻</span>
            {{ isLoading ? '處理中...' : `確認支付 $${product?.price}` }}
          </button>
        </form>
      </div>
      
      <!-- Footer Security Badge -->
      <div class="bg-gray-800/50 px-6 py-3 text-center border-t border-gray-700">
        <p class="text-xs text-gray-500 flex items-center justify-center gap-1">
          <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"></path></svg>
          256-bit SSL 加密傳輸，您的資料絕對安全
        </p>
      </div>

    </div>
  </div>
</template>

<style scoped>
.input-dark {
  @apply w-full bg-gray-900 border border-gray-700 text-white rounded px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors;
}
@keyframes fadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
.animate-fadeIn {
  animation: fadeIn 0.2s ease-out;
}
</style>