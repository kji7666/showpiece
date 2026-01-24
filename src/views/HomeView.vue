<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import Swal from 'sweetalert2'; 
import { supabase } from '@/supabase'; // 引入 Supabase

const router = useRouter();

// --- 1. 輪播圖資料 ---
const heroSlides = [
  {
    id: 1,
    // 這裡建議換成您上傳到 Supabase Storage 的公開連結，或是外部圖床連結
    image: 'display1.jpg', 
    title: '提供高品質物理渲染材質',
    subtitle: 'Provides high-quality physically rendered materials'
  },
  {
    id: 2,
    image: 'display2.jpg', 
    title: '專業精緻印刷加工',
    subtitle: 'Professional exquisite printing processing'
  },
  {
    id: 3,
    image: 'display3.jpg', 
    title: '印前設計/後加工一條龍服務',
    subtitle: 'Pre-press design/post-processing one-stop service'
  }
];

const currentSlide = ref(0);
let slideInterval = null;

const startSlideShow = () => {
  slideInterval = setInterval(() => {
    currentSlide.value = (currentSlide.value + 1) % heroSlides.length;
  }, 5000);
};

const setSlide = (index) => {
  currentSlide.value = index;
  clearInterval(slideInterval);
  startSlideShow();
};

// --- 2. 特色介紹資料 ---
const features = [
  {
    title: 'PBR材質貼圖',
    desc: "透過這個平台，室內外設計師可以下載產品PBR材質貼圖，用於 3D 視覺渲染。這樣一來，建材商與設計師之間的使用體驗更加緊密，不會因為從網路下載而不知道建材尺寸和來源。",
    icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
  },
  {
    title: '官方網站',
    desc: '目前，由於我們剛起步，材料數量有限，但我們會努力補充更多內容。如果使用者在使用過程中有任何需要改善的地方，歡迎到如藝官網，透過電子郵件聯絡我們，我們將竭誠為您服務。',
    icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
  },
  {
    title: 'LINE',
    desc: '另外印刷品是我公司平常接案產品，如果有印刷也歡迎洽購，歡迎您加入LINE如有新作品我們會優先放在官網上讓您優先取得',
    icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
  }
];

// --- 3. 熱門素材 (從 Supabase 抓取) ---
const trendingMaterials = ref([]);

const fetchTrending = async () => {
  try {
    // 抓取最新的 4 筆資料
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(4);

    if (error) throw error;

    trendingMaterials.value = data.map(item => {
      let imageUrl = item.cover_image;
      // 處理圖片路徑：如果是相對路徑，補上 Supabase Storage 前綴
      if (item.cover_image && !item.cover_image.startsWith('http')) {
         const { data } = supabase.storage.from('pbr-files').getPublicUrl(item.cover_image);
         imageUrl = data.publicUrl;
      }

      return {
        id: item.id,
        name: item.name,
        type: item.category || 'PBR',
        image: imageUrl
      };
    });

  } catch (err) {
    console.error('熱門素材載入失敗:', err);
  }
};

const goToDetail = () => {
  router.push('/pbr');
};

// --- 4. 軟體支援度資料 ---
const softwareCompat = [
  { name: 'Enscape', base: true, normal: true, rough: true, metal: false, ao: false, disp: 'warn', note: '只吃 3-4 張圖' },
  { name: 'Lumion', base: true, normal: true, rough: true, metal: 'warn', ao: 'warn', disp: true, note: 'AO/Metallic 插槽形同虛設' },
  { name: 'D5 Render', base: true, normal: true, rough: true, metal: true, ao: true, disp: true, note: '幾乎完整 PBR' },
  { name: 'Twinmotion', base: true, normal: true, rough: true, metal: true, ao: true, disp: true, note: '基於 Unreal，完整 PBR' },
  { name: 'Unreal Engine', base: true, normal: true, rough: true, metal: true, ao: true, disp: true, note: '完全 PBR' },
  { name: 'Blender', base: true, normal: true, rough: true, metal: true, ao: true, disp: true, note: 'Principled BSDF 一次接全套' },
  { name: 'V-Ray Next', base: true, normal: true, rough: true, metal: true, ao: true, disp: true, note: '新版支援 Metal-Rough' },
];

// --- 5. 著作權聲明彈窗 ---
const showCopyright = () => {
  Swal.fire({
    title: '著作權聲明 (Copyright Notice)',
    html: `
      <div style="text-align: left; font-size: 0.95rem; line-height: 1.6; color: #ccc;">
        <p>本網站所提供之所有材質檔案（包括但不限於圖片、PBR材質、貼圖等），其著作權均為 <strong>如藝印製品企業有限公司</strong> 所擁有，僅供設計師或使用者免費下載並於個人或商業專案中使用。</p>
        <br>
        <p>使用者在下載及使用本網站之資源時，須遵守以下條款：</p>
        <ol style="margin-left: 20px; margin-top: 10px;">
          <li>僅限於本網站直接下載使用。嚴禁將任何檔案轉載、轉傳、分享或以任何形式提供給第三方。</li>
          <li>不得上傳至其他網站或平台供他人下載。</li>
          <li>不得轉售、販售或以任何形式商業化再分發本網站之檔案。</li>
        </ol>
        <br>
        <p style="color: #ff6b6b; font-weight: bold;">違反上述條款者，本網站保留法律追訴權。</p>
        <p>如需大量使用或特殊用途，請與本站聯繫取得授權。</p>
      </div>
    `,
    icon: 'info',
    confirmButtonText: '我已了解並同意',
    background: '#1E1E1E', 
    color: '#fff',         
    width: '600px',
    customClass: {
      htmlContainer: 'text-left' 
    }
  });
};

// --- 生命週期 ---
onMounted(() => {
  startSlideShow();
  fetchTrending(); // 抓取真實資料
});

onUnmounted(() => {
  if (slideInterval) clearInterval(slideInterval);
});
</script>

<template>
  <div class="flex flex-col min-h-screen">
    
    <!-- 1. Hero Section: 輪播視覺區 -->
    <section class="relative h-[600px] overflow-hidden bg-gray-900">
      
      <!-- 輪播圖片層 -->
      <div 
        v-for="(slide, index) in heroSlides" 
        :key="slide.id"
        class="absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out"
        :class="index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'"
      >
        <img 
          :src="slide.image" 
          :alt="slide.title" 
          class="w-full h-full object-cover"
        />
        <div class="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-[#121212]"></div>
      </div>

      <!-- 文字內容層 -->
      <div class="absolute inset-0 z-20 flex items-center justify-center text-center px-4">
        <div class="max-w-4xl mx-auto w-full flex flex-col items-center">
        
          
          <!-- 動態文字容器 -->
          <div class="relative w-full h-40 md:h-56 mb-8">
            <div 
              v-for="(slide, index) in heroSlides" 
              :key="'text-' + slide.id"
              class="absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000 ease-out"
              :class="index === currentSlide 
                ? 'opacity-100 translate-y-0 delay-300' 
                : 'opacity-0 translate-y-8 pointer-events-none'"
            >
              <h1 class="text-5xl md:text-7xl font-extrabold text-white tracking-tight mb-6 drop-shadow-xl">
                {{ slide.title }}
              </h1>
              <p class="text-xl text-gray-200 max-w-2xl mx-auto leading-relaxed drop-shadow-md">
                {{ slide.subtitle }}
              </p>
            </div>
          </div>
          
          <div class="flex flex-col sm:flex-row gap-4 justify-center relative z-30">
            <RouterLink 
              to="/pbr" 
              class="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-lg transition-transform hover:scale-105 shadow-lg shadow-blue-600/30"
            >
              瀏覽材質庫
            </RouterLink>
            <RouterLink 
              to="/signup" 
              class="px-8 py-4 bg-white/10 hover:bg-white/20 text-white border border-white/30 rounded-lg font-bold text-lg transition-colors backdrop-blur-sm"
            >
              免費加入會員
            </RouterLink>
          </div>

        </div>
      </div>

      <!-- 輪播指示點 -->
      <div class="absolute bottom-8 left-0 right-0 z-30 flex justify-center gap-3">
        <button 
          v-for="(slide, index) in heroSlides" 
          :key="'dot-' + slide.id"
          @click="setSlide(index)"
          class="w-3 h-3 rounded-full transition-all duration-300"
          :class="index === currentSlide ? 'bg-blue-500 w-8' : 'bg-white/50 hover:bg-white'"
        ></button>
      </div>

    </section>

    <!-- 2. Features: 特色介紹 -->
    <section class="py-20 bg-[#121212]">
      <div class="container mx-auto px-6">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold text-white mb-4">關於網站</h2>
          <p class="text-gray-400">嘉樂秀圖網是由如藝印製品企業有限公司建立的平台。<br></br>我們的初衷是為服務本公司的客戶群，幫助客戶將產品轉換成3D建材檔。</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div v-for="feature in features" :key="feature.title" class="bg-gray-800/50 p-8 rounded-2xl border border-gray-700/50 hover:bg-gray-800 transition-colors">
            <div class="w-14 h-14 bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-400 mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="feature.icon" />
              </svg>
            </div>
            <h3 class="text-xl font-bold text-white mb-3">{{ feature.title }}</h3>
            <p class="text-gray-400 leading-relaxed">{{ feature.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. Showcase: 熱門素材展示 (真實資料) -->
    <section class="py-20 bg-gray-900">
      <div class="container mx-auto px-6">
        <div class="flex justify-between items-end mb-10">
          <div>
            <h2 class="text-3xl font-bold text-white mb-2">最新上架材質</h2>
            <p class="text-gray-400">社群創作者最愛使用的精選素材</p>
          </div>
          <RouterLink to="/pbr" class="text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1">
            查看全部
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </RouterLink>
        </div>

        <div v-if="trendingMaterials.length === 0" class="text-center text-gray-500 py-10">
          目前尚無熱門素材
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div 
            v-for="item in trendingMaterials" 
            :key="item.id" 
            @click="goToDetail"
            class="group relative rounded-xl overflow-hidden aspect-square cursor-pointer border border-gray-800 hover:border-blue-500/50 transition-all"
          >
            <img 
              :src="item.image" 
              :alt="item.name" 
              class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              @error="$event.target.src = 'https://placehold.co/600x400?text=No+Image'"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity"></div>
            <div class="absolute bottom-4 left-4 right-4">
              <span class="text-xs font-bold text-blue-400 uppercase tracking-wider bg-blue-900/30 px-2 py-1 rounded backdrop-blur-sm">
                {{ item.type }}
              </span>
              <h4 class="text-white font-bold text-lg mt-2 truncate">{{ item.name }}</h4>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. 軟體支援度對照表 -->
    <section class="py-20 bg-[#181818]">
      <div class="container mx-auto px-6">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold text-white mb-4">廣泛支援各大渲染引擎</h2>
          <p class="text-gray-400">無論您使用哪種軟體，PBR Master 都能提供最佳的貼圖方案。</p>
        </div>

        <div class="overflow-x-auto bg-[#1E1E1E] rounded-xl border border-gray-800 shadow-xl">
          <table class="w-full text-left border-collapse">
            <thead>
              <tr class="bg-gray-900 text-gray-300 text-sm uppercase tracking-wider border-b border-gray-700">
                <th class="p-4 font-bold sticky left-0 bg-gray-900 z-10 border-r border-gray-700">軟體 / 引擎</th>
                <th class="p-4 text-center">Color</th>
                <th class="p-4 text-center">Normal</th>
                <th class="p-4 text-center">Rough</th>
                <th class="p-4 text-center">Metal</th>
                <th class="p-4 text-center">AO</th>
                <th class="p-4 text-center">Disp</th>
                <th class="p-4 min-w-[200px]">備註</th>
              </tr>
            </thead>
            <tbody class="text-sm text-gray-300">
              <tr v-for="sw in softwareCompat" :key="sw.name" class="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                <td class="p-4 font-bold text-white sticky left-0 bg-[#1E1E1E] border-r border-gray-800 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                  {{ sw.name }}
                </td>
                <td v-for="(val, key) in {b: sw.base, n: sw.normal, r: sw.rough, m: sw.metal, a: sw.ao, d: sw.disp}" :key="key" class="p-4 text-center">
                  <svg v-if="val === true" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mx-auto text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <svg v-else-if="val === false" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mx-auto text-red-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mx-auto text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </td>
                <td class="p-4 text-gray-500 text-xs">
                  {{ sw.note }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p class="text-center text-xs text-gray-600 mt-4 md:hidden">← 左右滑動查看完整表格 →</p>
      </div>
    </section>

    <!-- 6. Footer: 簡易頁腳 (含著作權聲明與官網連結) -->
    <footer class="bg-black py-10 border-t border-gray-800">
      <div class="container mx-auto px-6 text-center">
        
        <h2 class="text-2xl font-bold text-white mb-4">PBR Master</h2>
        
        <div class="flex justify-center items-center gap-6 text-gray-400 mb-8">
          <!-- 點擊觸發彈窗 -->
          <button 
            @click="showCopyright" 
            class="hover:text-white transition-colors text-sm font-medium border-b border-transparent hover:border-white pb-0.5"
          >
            著作權聲明 (Copyright Notice)
          </button>

          <span class="text-gray-700">|</span>

          <!-- 如藝官網連結 (請替換 href) -->
          <a 
            href="https://joyprint.com.tw/" 
            target="_blank"
            class="hover:text-white transition-colors text-sm font-medium border-b border-transparent hover:border-white pb-0.5"
          >
            如藝官網
          </a>
        </div>

        <p class="text-gray-600 text-sm">
          &copy; 2024 PBR Master. All rights reserved. 
          <br>Designed for Professionals.
        </p>
      </div>
    </footer>

  </div>
</template>

<style scoped>
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up {
  animation: fadeInUp 0.8s ease-out;
}
</style>