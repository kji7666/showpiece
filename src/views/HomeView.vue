<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import Swal from 'sweetalert2'; 
import { supabase } from '@/supabase'; 

const router = useRouter();

// --- Phase 2：build 後預渲染完成訊號 ---
// prerender 腳本會等待這個屬性，確保 SEO metadata 與首頁動態內容都已渲染。
const markPrerenderReady = () => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-prerender-ready', 'true');
  }
};

// --- SEO：Phase 1 ---
const setSeo = ({ title, description, canonical }) => {
  document.title = title;

  const upsertMeta = (selector, attrs) => {
    let el = document.head.querySelector(selector);
    if (!el) {
      el = document.createElement('meta');
      document.head.appendChild(el);
    }
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  };

  const upsertCanonical = (href) => {
    let el = document.head.querySelector('link[rel="canonical"]');
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', 'canonical');
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  };

  upsertMeta('meta[name="description"]', { name: 'description', content: description });
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
  upsertCanonical(canonical);
};

// --- 1. 輪播圖資料 ---
const heroSlides = [
  {
    id: 1,
    image: 'display1.jpg',
    title: '真實建材轉換為 PBR 材質貼圖',
    subtitle: '讓建材產品更容易應用於 3D 建築與室內設計視覺化'
  },
  {
    id: 2,
    image: 'display2.jpg',
    title: '支援主流 3D 渲染軟體',
    subtitle: '適用於 Blender、D5 Render、Enscape、Lumion、Twinmotion 等工作流程'
  },
  {
    id: 3,
    image: 'display3.jpg',
    title: '保留產品品牌、尺寸與材質來源',
    subtitle: '讓設計師下載的不只是貼圖，也能知道實際建材的規格與來源'
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
    title: '建材 PBR 材質貼圖',
    desc: '將木地板、磁磚、石材等實際建材產品轉換為可供 3D 視覺渲染使用的 PBR 材質貼圖，方便設計師直接套用於建築與室內設計專案。',
    icon: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z'
  },
  {
    title: '保留產品規格與來源',
    desc: '材質不只提供貼圖，也保留品牌、品名、分類、尺寸與系列色號等資訊，降低從一般網路素材下載後無法確認真實建材來源與規格的問題。',
    icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'
  }
];

// --- 3. 熱門素材 ---
const trendingMaterials = ref([]);

const fetchTrending = async () => {
  try {
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(4);

    if (error) throw error;

    trendingMaterials.value = data.map(item => {
      let imageUrl = item.cover_image;
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

const slugify = (value) => {
  const normalized = String(value || 'material')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'material';
};

const goToDetail = (item) => {
  router.push(`/pbr/product/${item.id}/${slugify(item.name)}`);
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
      <div style="text-align: left; font-size: 0.95rem; line-height: 1.6; color: #555;">
        <p>本網站所提供之所有材質檔案（包括但不限於圖片、PBR材質、貼圖等），其著作權均為 <strong>如藝印製品企業有限公司</strong> 所擁有，僅供設計師或使用者免費下載並於個人或商業專案中使用。</p>
        <br>
        <p>使用者在下載及使用本網站之資源時，須遵守以下條款：</p>
        <ol style="margin-left: 20px; margin-top: 10px;">
          <li>僅限於本網站直接下載使用。嚴禁將任何檔案轉載、轉傳、分享或以任何形式提供給第三方。</li>
          <li>不得上傳至其他網站或平台供他人下載。</li>
          <li>不得轉售、販售或以任何形式商業化再分發本網站之檔案。</li>
        </ol>
        <br>
        <p style="color: #d32f2f; font-weight: bold;">違反上述條款者，本網站保留法律追訴權。</p>
        <p>如需大量使用或特殊用途，請與本站聯繫取得授權。</p>
      </div>
    `,
    icon: 'info',
    confirmButtonText: '我已了解並同意',
    confirmButtonColor: '#005eb8', // SketchUp Blue
    background: '#ffffff', 
    color: '#333',         
    width: '600px',
    customClass: {
      htmlContainer: 'text-left' 
    }
  });
};

onMounted(async () => {
  setSeo({
    title: '嘉樂秀圖網｜建材 PBR 材質貼圖與 3D 視覺化素材庫',
    description: '嘉樂秀圖網提供木地板、磁磚、石材等建材 PBR 材質貼圖與 3D 視覺化素材，支援 Blender、D5 Render、Enscape、Lumion、Twinmotion 等渲染軟體。',
    canonical: 'https://www.showpiece.com.tw/'
  });

  startSlideShow();
  await fetchTrending();
  markPrerenderReady();
});

onUnmounted(() => {
  if (slideInterval) clearInterval(slideInterval);
});
</script>

<template>
  <!-- 背景改為淺灰色系，符合圖片風格 -->
  <div class="flex flex-col min-h-screen bg-[#f5f7fa] font-sans text-gray-800">
    
    <!-- 1. Hero Section -->
    <section class="relative h-[500px] md:h-[600px] overflow-hidden bg-gray-200">
      <div 
        v-for="(slide, index) in heroSlides" 
        :key="slide.id"
        class="absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out"
        :class="index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'"
      >
        <img :src="slide.image" :alt="slide.title" class="w-full h-full object-cover"/>
        <!-- 遮罩改淡一點，保持清新感，但要確保白字可讀 -->
        <div class="absolute inset-0 bg-gradient-to-b from-black/50 via-black/20 to-black/60"></div>
      </div>

      <div class="absolute inset-0 z-20 flex items-center justify-center text-center px-4">
        <div class="max-w-4xl mx-auto w-full flex flex-col items-center">
          <div class="mb-6">
            <h1 class="text-4xl md:text-6xl font-bold text-white tracking-tight mb-4 drop-shadow-lg">
              嘉樂秀圖網｜建材 PBR 材質貼圖與 3D 視覺化素材庫
            </h1>
            <p class="text-lg md:text-xl text-gray-100 max-w-3xl mx-auto leading-relaxed drop-shadow-md">
              提供真實建材產品製作的 PBR 材質貼圖，協助建材商與設計師將木地板、磁磚、石材等素材應用於 3D 建築與室內設計渲染。
            </p>
          </div>
          <div class="relative w-full h-24 md:h-28 mb-8">
            <div
              v-for="(slide, index) in heroSlides"
              :key="'text-' + slide.id"
              class="absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000 ease-out"
              :class="index === currentSlide ? 'opacity-100 translate-y-0 delay-300' : 'opacity-0 translate-y-8 pointer-events-none'"
            >
              <h2 class="text-xl md:text-2xl font-bold text-white mb-2 drop-shadow-lg">{{ slide.title }}</h2>
              <p class="text-sm md:text-base text-gray-100 max-w-2xl mx-auto leading-relaxed drop-shadow-md">{{ slide.subtitle }}</p>
            </div>
          </div>
          <!-- 按鈕改色：SketchUp Blue (#005eb8) -->
          <div class="flex flex-col sm:flex-row gap-4 justify-center relative z-30">
            <RouterLink to="/pbr" class="px-8 py-3 bg-[#005eb8] hover:bg-[#004a91] text-white rounded font-semibold text-lg transition-transform hover:scale-105 shadow-md">
              瀏覽材質庫
            </RouterLink>
            <RouterLink to="/signup" class="px-8 py-3 bg-white/20 hover:bg-white/30 text-white border border-white rounded font-semibold text-lg transition-colors backdrop-blur-sm">
              免費加入會員
            </RouterLink>
          </div>
        </div>
      </div>

      <div class="absolute bottom-8 left-0 right-0 z-30 flex justify-center gap-3">
        <button 
          v-for="(slide, index) in heroSlides" 
          :key="'dot-' + slide.id"
          :aria-label="`切換至第 ${index + 1} 張展示圖`"
          @click="setSlide(index)"
          class="w-3 h-3 rounded-full transition-all duration-300 shadow-sm border border-white/30"
          :class="index === currentSlide ? 'bg-[#005eb8] w-8' : 'bg-white hover:bg-gray-200'"
        ></button>
      </div>
    </section>

    <!-- 2. Features: 特色介紹 -->
    <section class="py-20 bg-white border-b border-gray-200">
      <div class="container mx-auto px-6">
        <div class="text-center mb-16">
          <h2 class="text-3xl font-bold text-[#333] mb-4">關於網站</h2>
          <p class="text-gray-600 max-w-2xl mx-auto">嘉樂秀圖網是由如藝印製品企業有限公司建立的建材數位素材平台。<br>我們將實際建材產品轉換為可用於 3D 建築與室內設計渲染的 PBR 材質貼圖，並保留產品品牌、尺寸與來源資訊。</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
          <!-- 卡片樣式：白底、淺灰邊框、陰影 -->
          <div v-for="feature in features" :key="feature.title" class="bg-white p-8 rounded-xl border border-gray-200 shadow-sm hover:shadow-lg transition-all duration-300">
            <!-- Icon 顏色改為藍色系 -->
            <div class="w-14 h-14 bg-blue-50 rounded-lg flex items-center justify-center text-[#005eb8] mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" :d="feature.icon" />
              </svg>
            </div>
            
            <h3 class="text-xl font-bold text-[#333] mb-3">
              <a 
                v-if="feature.link" 
                :href="feature.link" 
                target="_blank" 
                rel="noopener noreferrer"
                class="text-[#005eb8] hover:text-[#004a91] transition-colors hover:underline underline-offset-4"
              >
                {{ feature.title }}
              </a>
              <span v-else>{{ feature.title }}</span>
            </h3>
            
            <p class="text-gray-600 leading-relaxed">{{ feature.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Phase 3：可爬取的材質分類入口 -->
    <section class="py-14 bg-[#f9fafb] border-b border-gray-200">
      <div class="container mx-auto px-6">
        <div class="text-center mb-8">
          <h2 class="text-3xl font-bold text-[#333] mb-3">依建材類型瀏覽 PBR 材質</h2>
          <p class="text-gray-600">直接進入木地板、磁磚、石材與壁紙材質頁，尋找適合 3D 渲染與室內設計使用的素材。</p>
        </div>
        <nav aria-label="PBR 材質分類" class="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <RouterLink to="/pbr/wood-floor" class="bg-white border border-gray-200 rounded-lg p-5 text-center font-bold text-gray-800 hover:border-[#005eb8] hover:text-[#005eb8] hover:shadow-md transition-all">木地板 PBR</RouterLink>
          <RouterLink to="/pbr/tile" class="bg-white border border-gray-200 rounded-lg p-5 text-center font-bold text-gray-800 hover:border-[#005eb8] hover:text-[#005eb8] hover:shadow-md transition-all">磁磚 PBR</RouterLink>
          <RouterLink to="/pbr/stone" class="bg-white border border-gray-200 rounded-lg p-5 text-center font-bold text-gray-800 hover:border-[#005eb8] hover:text-[#005eb8] hover:shadow-md transition-all">石材 PBR</RouterLink>
          <RouterLink to="/pbr/wallpaper" class="bg-white border border-gray-200 rounded-lg p-5 text-center font-bold text-gray-800 hover:border-[#005eb8] hover:text-[#005eb8] hover:shadow-md transition-all">壁紙 PBR</RouterLink>
        </nav>
      </div>
    </section>

    <!-- 3. Showcase -->
    <section class="py-20 bg-[#f9fafb]">
      <div class="container mx-auto px-6">
        <div class="flex justify-between items-end mb-10 border-b border-gray-300 pb-4">
          <div>
            <h2 class="text-3xl font-bold text-[#333] mb-2">最新上架材質</h2>
            <p class="text-gray-600">收錄實際建材產品製作的最新 PBR 材質貼圖</p>
          </div>
          <RouterLink to="/pbr" class="text-[#005eb8] hover:text-[#004a91] font-semibold flex items-center gap-1 transition-colors">
            查看全部
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </RouterLink>
        </div>

        <div v-if="trendingMaterials.length === 0" class="text-center text-gray-500 py-10 bg-white rounded-lg border border-gray-200">
          目前尚無熱門素材
        </div>

        <!-- 修改點：調整 Grid 卡片佈局 -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div 
            v-for="item in trendingMaterials" 
            :key="item.id" 
            @click="goToDetail(item)"
            class="group flex flex-col bg-white rounded-lg border border-gray-200 hover:border-[#005eb8] shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden"
          >
            <!-- 1. 圖片區域：改為 flex 居中 + object-contain (完整顯示) -->
            <!-- aspect-[4/3] 確保卡片有統一高度，p-4 提供留白 -->
            <div class="w-full aspect-[4/3] bg-white p-4 flex items-center justify-center overflow-hidden relative">
              <img 
                :src="item.image" 
                :alt="item.name" 
                class="max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-105"
                @error="$event.target.src = 'https://placehold.co/600x400?text=No+Image'"
              />
            </div>
            
            <!-- 2. 文字資訊區域：獨立在下方 (不再是 absolute 覆蓋) -->
            <div class="p-4 border-t border-gray-100 flex flex-col justify-end bg-white">
              <!-- 標籤 -->
              <div class="mb-2">
                <span class="text-xs font-bold text-[#005eb8] bg-blue-50 px-2 py-1 rounded inline-block">
                  {{ item.type }}
                </span>
              </div>
              <!-- 標題 -->
              <h4 class="text-gray-800 font-bold text-lg truncate leading-tight">
                {{ item.name }}
              </h4>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. Software Support -->
    <section class="py-20 bg-white">
      <div class="container mx-auto px-6">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold text-[#333] mb-4">廣泛支援各大渲染引擎</h2>
          <p class="text-gray-600">嘉樂秀圖網提供適用於多種 3D 渲染軟體的 PBR 材質貼圖。</p>
        </div>

        <div class="overflow-x-auto bg-white rounded-lg border border-gray-300 shadow-md">
          <table class="w-full text-left border-collapse">
            <thead>
              <!-- 表頭改為淺灰底、深色字 -->
              <tr class="bg-gray-100 text-gray-700 text-sm uppercase tracking-wider border-b border-gray-300">
                <th class="p-4 font-bold sticky left-0 bg-gray-100 z-10 border-r border-gray-300">軟體 / 引擎</th>
                <th class="p-4 text-center">Color</th>
                <th class="p-4 text-center">Normal</th>
                <th class="p-4 text-center">Rough</th>
                <th class="p-4 text-center">Metal</th>
                <th class="p-4 text-center">AO</th>
                <th class="p-4 text-center">Disp</th>
                <th class="p-4 min-w-[200px]">備註</th>
              </tr>
            </thead>
            <tbody class="text-sm text-gray-700">
              <tr v-for="sw in softwareCompat" :key="sw.name" class="border-b border-gray-200 hover:bg-blue-50/50 transition-colors">
                <!-- 第一欄固定 -->
                <td class="p-4 font-bold text-gray-900 sticky left-0 bg-white border-r border-gray-200 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">
                  {{ sw.name }}
                </td>
                <td v-for="(val, key) in {b: sw.base, n: sw.normal, r: sw.rough, m: sw.metal, a: sw.ao, d: sw.disp}" :key="key" class="p-4 text-center">
                  <svg v-if="val === true" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mx-auto text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <svg v-else-if="val === false" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mx-auto text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mx-auto text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
        <p class="text-center text-xs text-gray-500 mt-4 md:hidden">← 左右滑動查看完整表格 →</p>
      </div>
    </section>

    <!-- Phase 5: PBR 使用指南與長尾搜尋入口 -->
    <section class="py-20 bg-[#f9fafb] border-t border-gray-200">
      <div class="container mx-auto px-6">
        <div class="text-center mb-12">
          <h2 class="text-3xl font-bold text-[#333] mb-3">PBR 材質使用指南</h2>
          <p class="text-gray-600 max-w-3xl mx-auto">了解 PBR 貼圖基礎，以及 Blender、D5 Render、Enscape、Lumion 等渲染軟體使用建材材質時的站內相容性資訊。</p>
        </div>
        <nav aria-label="PBR 使用指南" class="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <RouterLink to="/guide/pbr-materials" class="bg-white border border-gray-200 rounded-lg p-5 hover:border-[#005eb8] hover:shadow-md transition-all">
            <h3 class="font-bold text-gray-900 mb-2">PBR 材質基礎</h3>
            <p class="text-sm text-gray-600">認識 Color、Normal、Roughness、AO 等常見貼圖。</p>
          </RouterLink>
          <RouterLink to="/guide/pbr-for-blender" class="bg-white border border-gray-200 rounded-lg p-5 hover:border-[#005eb8] hover:shadow-md transition-all">
            <h3 class="font-bold text-gray-900 mb-2">Blender PBR</h3>
            <p class="text-sm text-gray-600">以 Principled BSDF 為核心的 PBR 使用方向。</p>
          </RouterLink>
          <RouterLink to="/guide/pbr-for-d5-render" class="bg-white border border-gray-200 rounded-lg p-5 hover:border-[#005eb8] hover:shadow-md transition-all">
            <h3 class="font-bold text-gray-900 mb-2">D5 Render PBR</h3>
            <p class="text-sm text-gray-600">整理站內列出的主要 PBR maps 相容範圍。</p>
          </RouterLink>
          <RouterLink to="/guide/pbr-for-enscape" class="bg-white border border-gray-200 rounded-lg p-5 hover:border-[#005eb8] hover:shadow-md transition-all">
            <h3 class="font-bold text-gray-900 mb-2">Enscape PBR</h3>
            <p class="text-sm text-gray-600">優先使用 Base Color、Normal 與 Roughness。</p>
          </RouterLink>
          <RouterLink to="/guide/pbr-for-lumion" class="bg-white border border-gray-200 rounded-lg p-5 hover:border-[#005eb8] hover:shadow-md transition-all">
            <h3 class="font-bold text-gray-900 mb-2">Lumion PBR</h3>
            <p class="text-sm text-gray-600">整理主要 maps 與有限支援項目的使用方向。</p>
          </RouterLink>
        </nav>
      </div>
    </section>

    <!-- 6. Footer -->
    <!-- 改為深色頁尾但色調偏藍灰，或保持深黑作為視覺收尾 -->
    <footer class="bg-[#333333] py-10 text-white border-t border-gray-700">
      <div class="container mx-auto px-6 text-center">
        <h2 class="text-2xl font-bold mb-4">嘉樂秀圖網</h2>
        <div class="flex justify-center items-center gap-6 text-gray-400 mb-8">
          <button @click="showCopyright" class="hover:text-white transition-colors text-sm font-medium border-b border-transparent hover:border-white pb-0.5">
            著作權聲明 (Copyright Notice)
          </button>
          <span class="text-gray-600">|</span>
          <a href="https://joyprint.com.tw/" target="_blank" class="hover:text-white transition-colors text-sm font-medium border-b border-transparent hover:border-white pb-0.5">
            如藝官網
          </a>
        </div>
        <p class="text-gray-500 text-sm">
          &copy; 2024 嘉樂秀圖網. All rights reserved. 
          <br>Designed for Professionals.
        </p>
      </div>
    </footer>

  </div>
</template>

<style scoped>
/* 確保字體清晰 */
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up {
  animation: fadeInUp 0.8s ease-out;
}
</style>