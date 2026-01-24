import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// --- 1. 引入 Toast ---
import Toast from "vue-toastification";
import "vue-toastification/dist/index.css";

const app = createApp(App)

app.use(createPinia())
app.use(router)

// --- 2. Toast 設定 (深色模式優化) ---
const toastOptions = {
    position: "top-right",
    timeout: 3000,
    closeOnClick: true,
    pauseOnFocusLoss: true,
    pauseOnHover: true,
    draggable: true,
    draggablePercent: 0.6,
    showCloseButtonOnHover: false,
    hideProgressBar: false,
    closeButton: "button",
    icon: true,
    rtl: false,
    // 自定義 Toast 的容器樣式 (可選)
    toastClassName: "my-custom-toast-class",
    bodyClassName: ["my-custom-toast-body-class"]
};

app.use(Toast, toastOptions);

app.mount('#app')