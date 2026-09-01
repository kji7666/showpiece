<script setup>
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

const route = useRoute();

const GUIDE_CONFIG = {
  'pbr-materials': {
    title: 'PBR 材質是什麼？建材 3D 視覺化的貼圖基礎',
    shortTitle: 'PBR 材質基礎',
    description: '了解 PBR 材質常見的 Base Color、Normal、Roughness、Metallic、AO 與 Displacement 貼圖，以及它們在建材 3D 視覺化中的用途。',
    intro: 'PBR（Physically Based Rendering）材質是一套讓 3D 軟體以較一致方式描述表面外觀的工作流程。對建材而言，重點不是只拿到一張顏色圖片，而是把表面顏色、凹凸、粗糙度與位移等資訊拆成不同貼圖，讓渲染軟體能更接近真實材質表現。',
    sections: [
      {
        heading: '常見 PBR 貼圖',
        paragraphs: [
          '嘉樂秀圖網目前以 Base Color、Normal、Roughness、Metallic、AO 與 Displacement 作為主要相容性欄位。不同渲染軟體支援程度不同，實際使用時應依軟體可用的材質插槽選擇貼圖。',
        ],
        items: [
          ['Base Color', '描述材質本身的主要顏色與圖樣。'],
          ['Normal', '用來表現表面細小凹凸，不必真的增加模型幾何。'],
          ['Roughness', '控制表面反射的銳利或粗糙程度。'],
          ['Metallic', '用來描述金屬性質；是否需要取決於材質與軟體。'],
          ['AO', '用來加強接縫與遮蔽位置的陰影資訊。'],
          ['Displacement', '可用貼圖改變表面高度感；軟體支援方式會不同。'],
        ],
      },
      {
        heading: '建材為什麼需要 PBR，而不只是一般圖片？',
        paragraphs: [
          '一般圖片通常只保留外觀顏色，缺少表面粗糙度、凹凸與高度等資訊。對木地板、磁磚、石材等建材而言，這些表面特性會直接影響 3D 渲染結果。把真實建材整理成 PBR 材質，可以讓設計師在不同場景與光線下重複使用。',
          '嘉樂秀圖網的定位是把實際建材產品轉換成可下載的 PBR 材質，同時保留品牌、品名、分類、尺寸與系列色號等產品資訊，減少只從一般素材網站下載貼圖後不知道來源與真實規格的問題。',
        ],
      },
      {
        heading: '下載後怎麼開始？',
        paragraphs: [
          '先從 Base Color、Normal 與 Roughness 開始，通常已能建立基本材質外觀。再依你使用的軟體與材質特性加入 Metallic、AO 或 Displacement。',
        ],
      },
    ],
    related: ['pbr-for-blender', 'pbr-for-d5-render', 'pbr-for-enscape', 'pbr-for-lumion'],
  },
  'pbr-for-blender': {
    title: 'Blender PBR 材質貼圖使用指南｜嘉樂秀圖網',
    shortTitle: 'Blender PBR',
    description: 'Blender 使用 PBR 材質貼圖的基本流程，整理 Base Color、Normal、Roughness、Metallic、AO 與 Displacement 的使用方向。',
    intro: '依嘉樂秀圖網目前的軟體相容性表，Blender 可使用 Base Color、Normal、Roughness、Metallic、AO 與 Displacement 等 PBR 貼圖。網站現有說明以 Principled BSDF 作為主要 PBR 材質工作流程。',
    sections: [
      {
        heading: 'Blender 可使用哪些 PBR 貼圖？',
        paragraphs: ['目前站內相容性表將 Blender 標示為完整支援主要 PBR 貼圖欄位。'],
        items: [
          ['Base Color', '主要顏色與圖樣。'],
          ['Normal', '表面細節與凹凸。'],
          ['Roughness', '控制反射粗糙程度。'],
          ['Metallic', '金屬性質。'],
          ['AO', '遮蔽陰影資訊。'],
          ['Displacement', '表面高度與位移效果。'],
        ],
      },
      {
        heading: '建議工作流程',
        paragraphs: [
          '先建立材質並以 Principled BSDF 為核心，依材質包提供的貼圖逐一接到相對應的材質輸入。若只是快速預覽，可先使用 Base Color、Normal 與 Roughness，再依需要增加其他貼圖。',
          '不同 Blender 版本、Color Space 設定與節點接法可能影響結果，因此本頁先維持站內目前可確認的 PBR maps 相容範圍，不把特定版本操作步驟寫死。',
        ],
      },
    ],
    related: ['pbr-materials', 'pbr-for-d5-render'],
  },
  'pbr-for-d5-render': {
    title: 'D5 Render PBR 材質貼圖使用指南｜嘉樂秀圖網',
    shortTitle: 'D5 Render PBR',
    description: 'D5 Render 使用 PBR 建材貼圖的基本整理，包含 Base Color、Normal、Roughness、Metallic、AO 與 Displacement 的站內相容性資訊。',
    intro: '依嘉樂秀圖網目前的相容性表，D5 Render 對主要 PBR maps 的支援較完整，Base Color、Normal、Roughness、Metallic、AO 與 Displacement 都列為可使用。',
    sections: [
      {
        heading: 'D5 Render 可使用哪些貼圖？',
        paragraphs: ['目前站內資料將 D5 Render 標示為幾乎完整 PBR，適合直接使用嘉樂秀圖網提供的多張材質貼圖。'],
        items: [
          ['Base Color', '主要顏色與材質圖樣。'],
          ['Normal', '細部凹凸。'],
          ['Roughness', '反射粗糙程度。'],
          ['Metallic', '金屬特性。'],
          ['AO', '遮蔽陰影資訊。'],
          ['Displacement', '表面位移效果。'],
        ],
      },
      {
        heading: '建議使用方式',
        paragraphs: [
          '快速建立建材時，可以先套用 Base Color、Normal 與 Roughness；需要更完整表面資訊時，再加入 Metallic、AO 與 Displacement。實際效果仍會受到材質類型、模型比例與場景光線影響。',
        ],
      },
    ],
    related: ['pbr-materials', 'pbr-for-blender', 'pbr-for-enscape'],
  },
  'pbr-for-enscape': {
    title: 'Enscape PBR 材質貼圖使用指南｜嘉樂秀圖網',
    shortTitle: 'Enscape PBR',
    description: 'Enscape 使用建材 PBR 貼圖時可優先使用哪些 maps？整理嘉樂秀圖網目前的 Base Color、Normal、Roughness 與 Displacement 相容性資訊。',
    intro: '依嘉樂秀圖網目前的軟體相容性表，Enscape 主要可使用 Base Color、Normal 與 Roughness；Displacement 標示為視情況支援，而 Metallic 與 AO 目前未列為主要可用欄位。',
    sections: [
      {
        heading: 'Enscape 優先使用哪些貼圖？',
        paragraphs: ['站內相容性資料顯示 Enscape 的工作流程可先集中在 3 至 4 張主要貼圖，不需要為了完整 PBR maps 而全部強行使用。'],
        items: [
          ['Base Color', '可使用。'],
          ['Normal', '可使用。'],
          ['Roughness', '可使用。'],
          ['Metallic', '目前站內相容性表未列為主要支援。'],
          ['AO', '目前站內相容性表未列為主要支援。'],
          ['Displacement', '站內標示為視情況使用。'],
        ],
      },
      {
        heading: '建議工作流程',
        paragraphs: [
          '如果你從嘉樂秀圖網下載完整材質包，使用 Enscape 時不一定要把每一張 map 都套上。可以先使用 Base Color、Normal、Roughness，之後再依實際材質與軟體介面評估 Displacement。',
        ],
      },
    ],
    related: ['pbr-materials', 'pbr-for-d5-render', 'pbr-for-lumion'],
  },
  'pbr-for-lumion': {
    title: 'Lumion PBR 材質貼圖使用指南｜嘉樂秀圖網',
    shortTitle: 'Lumion PBR',
    description: 'Lumion 使用建材 PBR 貼圖的基本整理，包含 Base Color、Normal、Roughness、Displacement，以及 Metallic、AO 的站內相容性說明。',
    intro: '依嘉樂秀圖網目前的軟體相容性表，Lumion 可使用 Base Color、Normal、Roughness 與 Displacement；Metallic 與 AO 標示為有限或視工作流程而定。',
    sections: [
      {
        heading: 'Lumion 的 PBR maps 使用方向',
        paragraphs: ['目前站內相容性表建議把主要注意力放在 Base Color、Normal、Roughness 與 Displacement。'],
        items: [
          ['Base Color', '可使用。'],
          ['Normal', '可使用。'],
          ['Roughness', '可使用。'],
          ['Metallic', '站內標示為有限／視情況。'],
          ['AO', '站內標示為有限／視情況。'],
          ['Displacement', '可使用。'],
        ],
      },
      {
        heading: '建議工作流程',
        paragraphs: [
          '先利用 Base Color 建立產品外觀，再以 Normal 與 Roughness 補充表面細節；需要高度感時再加入 Displacement。Metallic 與 AO 是否投入使用，應依 Lumion 實際材質介面與你的版本確認。',
        ],
      },
    ],
    related: ['pbr-materials', 'pbr-for-enscape', 'pbr-for-d5-render'],
  },
};

const guideSlug = computed(() => String(route.params.guideSlug || ''));
const guide = computed(() => GUIDE_CONFIG[guideSlug.value] || null);
const relatedGuides = computed(() => (guide.value?.related || []).map((slug) => ({ slug, ...GUIDE_CONFIG[slug] })).filter((item) => item.title));

const markPrerenderReady = () => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-prerender-ready', 'true');
  }
};

const upsertMeta = (selector, attrs) => {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
};

const setSeo = () => {
  document.head.querySelectorAll('script[data-phase5-jsonld]').forEach((el) => el.remove());

  if (!guide.value) {
    document.title = '找不到指南｜嘉樂秀圖網';
    upsertMeta('meta[name="description"]', { name: 'description', content: '找不到指定的 PBR 使用指南。' });
    markPrerenderReady();
    return;
  }

  const canonical = `https://www.showpiece.com.tw/guide/${guideSlug.value}`;
  document.title = guide.value.title;
  upsertMeta('meta[name="description"]', { name: 'description', content: guide.value.description });
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: guide.value.title });
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: guide.value.description });
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'article' });
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary' });

  let canonicalEl = document.head.querySelector('link[rel="canonical"]');
  if (!canonicalEl) {
    canonicalEl = document.createElement('link');
    canonicalEl.rel = 'canonical';
    document.head.appendChild(canonicalEl);
  }
  canonicalEl.href = canonical;

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: guide.value.title,
    description: guide.value.description,
    url: canonical,
    inLanguage: 'zh-Hant',
    publisher: {
      '@type': 'Organization',
      name: '嘉樂秀圖網',
      url: 'https://www.showpiece.com.tw/',
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首頁', item: 'https://www.showpiece.com.tw/' },
      { '@type': 'ListItem', position: 2, name: 'PBR 使用指南', item: 'https://www.showpiece.com.tw/guide/pbr-materials' },
      { '@type': 'ListItem', position: 3, name: guide.value.shortTitle, item: canonical },
    ],
  };

  for (const schema of [articleSchema, breadcrumbSchema]) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.phase5Jsonld = 'true';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  }

  markPrerenderReady();
};

onMounted(setSeo);
watch(guideSlug, setSeo);

onUnmounted(() => {
  document.head.querySelectorAll('script[data-phase5-jsonld]').forEach((el) => el.remove());
});
</script>

<template>
  <main class="min-h-screen pt-24 pb-20 bg-[#f5f7fa] text-gray-800">
    <div v-if="guide" class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <nav aria-label="麵包屑" class="text-sm text-gray-500 mb-8">
        <RouterLink to="/" class="hover:text-[#005eb8]">首頁</RouterLink>
        <span class="mx-2">/</span>
        <RouterLink to="/guide/pbr-materials" class="hover:text-[#005eb8]">PBR 使用指南</RouterLink>
        <span class="mx-2">/</span>
        <span class="text-gray-700">{{ guide.shortTitle }}</span>
      </nav>

      <article class="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <header class="px-6 md:px-10 py-10 border-b border-gray-200">
          <p class="text-sm font-bold tracking-wide text-[#005eb8] mb-3">嘉樂秀圖網 PBR GUIDE</p>
          <h1 class="text-3xl md:text-5xl font-extrabold tracking-tight text-gray-900 mb-5">{{ guide.title }}</h1>
          <p class="text-lg text-gray-600 leading-relaxed">{{ guide.intro }}</p>
        </header>

        <div class="px-6 md:px-10 py-10 space-y-12">
          <section v-for="section in guide.sections" :key="section.heading">
            <h2 class="text-2xl md:text-3xl font-bold text-gray-900 mb-5">{{ section.heading }}</h2>
            <div class="space-y-4 text-gray-700 leading-8">
              <p v-for="paragraph in section.paragraphs" :key="paragraph">{{ paragraph }}</p>
            </div>

            <dl v-if="section.items" class="mt-6 divide-y divide-gray-200 border border-gray-200 rounded-lg overflow-hidden">
              <div v-for="item in section.items" :key="item[0]" class="grid md:grid-cols-[180px_1fr] gap-2 md:gap-6 p-4 bg-white">
                <dt class="font-bold text-gray-900">{{ item[0] }}</dt>
                <dd class="text-gray-600">{{ item[1] }}</dd>
              </div>
            </dl>
          </section>

          <section class="bg-blue-50 border border-blue-100 rounded-xl p-6 md:p-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-3">直接瀏覽真實建材 PBR 材質</h2>
            <p class="text-gray-700 leading-relaxed mb-6">嘉樂秀圖網提供木地板、磁磚、石材與壁紙等建材材質，並保留品牌、產品名稱、尺寸與系列色號等資訊。</p>
            <div class="flex flex-wrap gap-3">
              <RouterLink to="/pbr" class="px-5 py-3 bg-[#005eb8] text-white rounded font-bold hover:bg-[#004a91]">瀏覽全部 PBR 材質</RouterLink>
              <RouterLink to="/pbr/wood-floor" class="px-5 py-3 bg-white text-[#005eb8] border border-[#005eb8] rounded font-bold">木地板</RouterLink>
              <RouterLink to="/pbr/tile" class="px-5 py-3 bg-white text-[#005eb8] border border-[#005eb8] rounded font-bold">磁磚</RouterLink>
              <RouterLink to="/pbr/stone" class="px-5 py-3 bg-white text-[#005eb8] border border-[#005eb8] rounded font-bold">石材</RouterLink>
            </div>
          </section>

          <section v-if="relatedGuides.length">
            <h2 class="text-2xl font-bold text-gray-900 mb-5">相關 PBR 使用指南</h2>
            <div class="grid sm:grid-cols-2 gap-4">
              <RouterLink
                v-for="item in relatedGuides"
                :key="item.slug"
                :to="`/guide/${item.slug}`"
                class="block border border-gray-200 rounded-lg p-5 hover:border-[#005eb8] hover:shadow-sm transition-all"
              >
                <h3 class="font-bold text-gray-900 mb-2">{{ item.shortTitle }}</h3>
                <p class="text-sm text-gray-600 leading-relaxed">{{ item.description }}</p>
              </RouterLink>
            </div>
          </section>
        </div>
      </article>
    </div>

    <div v-else class="max-w-3xl mx-auto px-6 text-center py-24">
      <h1 class="text-3xl font-bold text-gray-900 mb-4">找不到此 PBR 使用指南</h1>
      <p class="text-gray-600 mb-6">此網址不存在或指南尚未建立。</p>
      <RouterLink to="/guide/pbr-materials" class="text-[#005eb8] font-bold hover:underline">查看 PBR 材質基礎指南</RouterLink>
    </div>
  </main>
</template>
