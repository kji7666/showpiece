import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user' 

import HomeView from '../views/HomeView.vue'
import PbrLibrary from '../views/PbrLibrary.vue'
import SignupView from '../views/SignupView.vue'
import ProfileView from '../views/ProfileView.vue'
import LoginView from '../views/LoginView.vue'
import AdminView from '../views/AdminView.vue'
import ContactView from '../views/ContactView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/pbr', name: 'pbr', component: PbrLibrary },
    { path: '/signup', name: 'signup', component: SignupView },
    {
      path: '/profile',
      name: 'profile',
      component: ProfileView,
      meta: { requiresAuth: true } 
    },
    { path: '/login', name: 'login', component: LoginView },
    {
      path: '/contact',
      name: 'contact',
      component: ContactView
    },
    {
      path: '/admin',
      name: 'admin',
      component: AdminView,
      meta: { requiresAuth: true, requiresAdmin: true } 
    }
  ],
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0 }
  }
})

// --- 全域路由守衛 (修正版) ---
// ⚠️ 注意：這裡必須加上 'async' 關鍵字，因為裡面用了 await
router.beforeEach(async (to, from, next) => {
    const userStore = useUserStore();
  
    // 0. 初始化檢查：確保 Store 有最新資料 (處理重新整理網頁的情況)
    // 假設 userStore.init() 會去檢查 Supabase Session 或 localStorage
    if (!userStore.user) {
      // 這裡加上 try-catch 是為了防止 init 出錯導致路由卡死
      try {
        await userStore.init(); 
      } catch (error) {
        console.error('路由守衛初始化失敗:', error);
      }
    }

    // 1. 檢查登入權限
    if (to.meta.requiresAuth && !userStore.isLoggedIn) {
      // 帶上 redirect 參數，讓登入頁知道是因為沒權限被踢過來的
      next({ path: '/login', query: { redirect: 'auth_required' } });
      return;
    }

    // 2. 檢查管理員權限
    if (to.meta.requiresAdmin && userStore.user?.role !== 'admin') {
      alert('權限不足：此頁面僅供管理員存取');
      next('/'); // 踢回首頁
      return;
    }

    // 3. 通行
    next();
})

export default router