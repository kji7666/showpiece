import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useUserStore = defineStore('user', () => {
  const user = ref(null);
  const token = ref(null);
  
  // 新增：已購買的材質 ID 列表
  const purchasedItemIds = ref([]); 

  const isLoggedIn = computed(() => !!user.value);
  const userName = computed(() => user.value?.name || 'Guest');

  // 判斷某個商品是否已購買
  const hasPurchased = (itemId) => purchasedItemIds.value.includes(itemId);

  function login(userData, apiToken) {
    user.value = userData;
    token.value = apiToken;
    // 模擬：每次登入先清空購買紀錄 (真實專案應從後端 API 抓取)
    purchasedItemIds.value = []; 
    
    localStorage.setItem('pbr_token', apiToken);
    localStorage.setItem('pbr_user', JSON.stringify(userData));
  }

  // 新增：將商品加入已購清單
  function addPurchase(itemId) {
    if (!purchasedItemIds.value.includes(itemId)) {
      purchasedItemIds.value.push(itemId);
    }
  }

  function logout() {
    user.value = null;
    token.value = null;
    purchasedItemIds.value = [];
    localStorage.removeItem('pbr_token');
    localStorage.removeItem('pbr_user');
    window.location.href = '/'; 
  }

  function init() {
    const storedToken = localStorage.getItem('pbr_token');
    const storedUser = localStorage.getItem('pbr_user');
    if (storedToken && storedUser) {
      token.value = storedToken;
      user.value = JSON.parse(storedUser);
    }
  }

  // 記得匯出新的方法
  return { 
    user, token, isLoggedIn, userName, purchasedItemIds, 
    login, logout, init, addPurchase, hasPurchased 
  };
});