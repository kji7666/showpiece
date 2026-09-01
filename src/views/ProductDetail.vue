<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useUserStore } from '@/stores/user';
import PayModal from '@/components/PayModal.vue';
import { supabase } from '@/supabase';
import { useToast } from 'vue-toastification';
import Swal from 'sweetalert2';
import { getR2DownloadLink } from '@/utils/r2';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();
const toast = useToast();

const product = ref(null);
const isLoading = ref(true);
const errorMsg = ref('');
const isPayModalOpen = ref(false);
const payTarget = ref(null);

const CATEGORY_CONFIG = {
  'wood-floor': { label: '木地板', aliases: ['木地板'] },
  tile: { label: '磁磚', aliases: ['磁磚', '磁砖', '瓷磚', '瓷砖'] },
  stone: { label: '石材', aliases: ['石材', '大理石', '花崗岩', '花岗岩'] },
  wallpaper: { label: '壁紙', aliases: ['壁紙', '壁纸', '壁布'] },
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

const categoryInfo = computed(() => {
  const category = String(product.value?.category || '').trim().toLowerCase();
  const entry = Object.entries(CATEGORY_CONFIG).find(([, config]) =>
    config.aliases.some((alias) => category.includes(alias.toLowerCase()))
  );
  return entry ? { slug: entry[0], ...entry[1] } : null;
});

const canonicalPath = computed(() => {
  if (!product.value) return `/pbr/product/${route.params.productId}`;
  return `/pbr/product/${product.value.id}/${slugify(product.value.name)}`;
});

const canonicalUrl = computed(() => `https://www.showpiece.com.tw${canonicalPath.value}`);

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
  if (!product.value) return;

  const brandPrefix = product.value.brand ? `${product.value.brand} ` : '';
  const categoryText = product.value.category || '建材';
  const title = `${brandPrefix}${product.value.name}｜${categoryText} PBR 材質－嘉樂秀圖網`;
  const description = product.value.description
    ? `${product.value.description}`.slice(0, 150)
    : `查看 ${brandPrefix}${product.value.name} 的 ${categoryText} PBR 材質資訊、規格、系列色號與 1K、2K、4K 下載選項。`;

  document.title = title;
  upsertMeta('meta[name="description"]', { name: 'description', content: description });
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'product' });
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl.value });
  if (product.value.image) {
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: product.value.image });
  }
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });

  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', canonicalUrl.value);
};

const setJsonLd = () => {
  if (!product.value) return;

  document.head.querySelectorAll('script[data-phase4-jsonld]').forEach((el) => el.remove());

  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.value.name,
    description: product.value.description || `${product.value.name} PBR 材質`,
    image: product.value.image ? [product.value.image] : undefined,
    sku: String(product.value.id),
    category: product.value.category || undefined,
    brand: product.value.brand
      ? { '@type': 'Brand', name: product.value.brand }
      : undefined,
    url: canonicalUrl.value,
  };

  const breadcrumbs = [
    { '@type': 'ListItem', position: 1, name: '首頁', item: 'https://www.showpiece.com.tw/' },
    { '@type': 'ListItem', position: 2, name: 'PBR 材質庫', item: 'https://www.showpiece.com.tw/pbr' },
  ];

  if (categoryInfo.value) {
    breadcrumbs.push({
      '@type': 'ListItem',
      position: 3,
      name: categoryInfo.value.label,
      item: `https://www.showpiece.com.tw/pbr/${categoryInfo.value.slug}`,
    });
  }

  breadcrumbs.push({
    '@type': 'ListItem',
    position: breadcrumbs.length + 1,
    name: product.value.name,
    item: canonicalUrl.value,
  });

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs,
  };

  for (const schema of [productSchema, breadcrumbSchema]) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.phase4Jsonld = 'true';
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  }
};

const fetchProduct = async () => {
  try {
    isLoading.value = true;
    errorMsg.value = '';

    const { data, error } = await supabase
      .from('materials')
      .select('*, material_variants (*)')
      .eq('id', route.params.productId)
      .single();

    if (error) throw error;
    if (!data) throw new Error('Product not found');

    product.value = {
      id: data.id,
      brand: data.brand,
      name: data.name,
      category: data.category,
      usage: data.usage,
      size: data.size,
      phone: data.phone,
      description: data.description,
      image: data.cover_image,
      price: Number(data.price),
      isPremium: data.is_premium,
      variants: (data.material_variants || [])
        .slice()
        .sort((a, b) => String(a.code || '').localeCompare(String(b.code || ''), 'zh-Hant'))
        .map((variant) => ({
          id: variant.id,
          code: variant.code,
          image: variant.image || data.cover_image,
          files: {
            '1K': variant.file_path_1k,
            '2K': variant.file_path_2k,
            '4K': variant.file_path_4k,
          },
        })),
    };

    setSeo();
    setJsonLd();
  } catch (error) {
    console.error('商品載入失敗:', error);
    errorMsg.value = '找不到此材質，或材質資料暫時無法載入。';
    document.title = '找不到材質｜嘉樂秀圖網';
  } finally {
    isLoading.value = false;
    markPrerenderReady();
  }
};

const getFileExtension = (filePath) => {
  const lower = String(filePath || '').toLowerCase();
  if (lower.endsWith('.tar.gz')) return 'tar.gz';
  if (lower.endsWith('.tgz')) return 'tgz';
  if (lower.endsWith('.rar')) return 'rar';
  if (lower.endsWith('.zip')) return 'zip';
  if (lower.endsWith('.7z')) return '7z';
  return 'zip';
};

const sanitizeDownloadName = (name) =>
  String(name || 'material').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');

const startDownload = async (variant, resolution) => {
  const filePath = variant.files?.[resolution];
  if (!filePath) {
    toast.warning(`抱歉，目前尚未上架 [${resolution}] 解析度的檔案。`);
    return;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('登入狀態已過期，請重新登入。');
      router.push({ path: '/signup', query: { redirect: 'session_expired' } });
      return;
    }

    toast.info('正在請求 R2 雲端下載...', { timeout: 1500 });
    const signedUrl = await getR2DownloadLink(filePath);
    const filename = `${sanitizeDownloadName(product.value.name)}-${sanitizeDownloadName(variant.code)}-${sanitizeDownloadName(resolution)}.${getFileExtension(filePath)}`;

    const link = document.createElement('a');
    link.href = signedUrl;
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`下載開始：${filename}`);
  } catch (error) {
    console.error('[download] failed:', error);
    toast.error('下載失敗：R2 連線錯誤或檔案不存在。');
  }
};

const handleDownload = (variant, resolution) => {
  if (!userStore.isLoggedIn) {
    Swal.fire({
      title: '需要會員權限',
      text: '下載此材質需要登入會員，是否前往登入？',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '前往登入',
      cancelButtonText: '稍後再說',
      background: '#fff',
      color: '#333',
      confirmButtonColor: '#005eb8',
    }).then((result) => {
      if (result.isConfirmed) {
        router.push({ path: '/signup', query: { redirect: 'auth_required' } });
      }
    });
    return;
  }

  const alreadyPurchased = userStore.hasPurchased(product.value.id);
  if (product.value.isPremium && !alreadyPurchased && product.value.price > 0) {
    payTarget.value = product.value;
    isPayModalOpen.value = true;
    return;
  }

  startDownload(variant, resolution);
};

const onPaymentSuccess = (itemId) => {
  userStore.addPurchase(itemId);
  isPayModalOpen.value = false;
  Swal.fire({
    title: '付款成功！',
    icon: 'success',
    background: '#fff',
    color: '#333',
    confirmButtonColor: '#005eb8',
  });
};

onMounted(fetchProduct);

onUnmounted(() => {
  document.head.querySelectorAll('script[data-phase4-jsonld]').forEach((el) => el.remove());
});
</script>

<template>
  <main class="min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8 bg-[#f5f7fa] text-gray-900">
    <div class="max-w-7xl mx-auto">
      <nav aria-label="麵包屑" class="text-sm text-gray-500 mb-6 flex flex-wrap gap-2 items-center">
        <RouterLink to="/" class="hover:text-[#005eb8]">首頁</RouterLink>
        <span>/</span>
        <RouterLink to="/pbr" class="hover:text-[#005eb8]">PBR 材質庫</RouterLink>
        <template v-if="categoryInfo">
          <span>/</span>
          <RouterLink :to="`/pbr/${categoryInfo.slug}`" class="hover:text-[#005eb8]">{{ categoryInfo.label }}</RouterLink>
        </template>
        <template v-if="product">
          <span>/</span>
          <span class="text-gray-700">{{ product.name }}</span>
        </template>
      </nav>

      <div v-if="isLoading" class="py-24 text-center">
        <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#005eb8] mx-auto mb-4"></div>
        <p class="text-gray-600">載入材質資料...</p>
      </div>

      <div v-else-if="errorMsg" class="py-24 text-center bg-white rounded-xl border border-gray-200">
        <h1 class="text-3xl font-bold text-gray-900 mb-3">找不到材質</h1>
        <p class="text-gray-600 mb-6">{{ errorMsg }}</p>
        <RouterLink to="/pbr" class="inline-block px-6 py-3 bg-[#005eb8] text-white rounded font-semibold">返回材質庫</RouterLink>
      </div>

      <template v-else-if="product">
        <article class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div class="grid grid-cols-1 lg:grid-cols-2 border-b border-gray-200">
            <div class="bg-gray-50 p-8 lg:p-12 flex items-center justify-center min-h-[360px]">
              <img
                :src="product.image"
                :alt="`${product.brand || ''} ${product.name} ${product.category || ''} PBR 材質`"
                class="max-w-full max-h-[520px] object-contain"
                @error="$event.target.src = 'https://placehold.co/800x800?text=No+Image'"
              >
            </div>

            <div class="p-8 lg:p-12 flex flex-col justify-center">
              <p v-if="product.brand" class="text-[#005eb8] font-bold tracking-wide mb-2">{{ product.brand }}</p>
              <h1 class="text-4xl lg:text-5xl font-extrabold text-gray-900 leading-tight mb-4">{{ product.name }}</h1>
              <p class="text-lg text-gray-600 mb-6">{{ product.category || 'PBR 建材材質' }}</p>

              <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-8">
                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <dt class="font-bold text-gray-800 mb-1">規格</dt>
                  <dd class="text-gray-600">{{ product.size || '依產品資料' }}</dd>
                </div>
                <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  <dt class="font-bold text-gray-800 mb-1">系列色號</dt>
                  <dd class="text-gray-600">{{ product.variants.length }} 色</dd>
                </div>
                <div v-if="product.usage" class="bg-gray-50 p-4 rounded-lg border border-gray-200 sm:col-span-2">
                  <dt class="font-bold text-gray-800 mb-1">適用用途</dt>
                  <dd class="text-gray-600">{{ product.usage }}</dd>
                </div>
              </dl>

              <section aria-labelledby="product-description-title">
                <h2 id="product-description-title" class="text-xl font-bold text-gray-900 mb-3">材質介紹</h2>
                <p class="text-gray-600 leading-relaxed">{{ product.description || `${product.name} 為嘉樂秀圖網收錄的實際建材 PBR 材質，可用於建築與室內設計 3D 視覺化。` }}</p>
              </section>
            </div>
          </div>

          <section class="p-8 lg:p-12" aria-labelledby="variants-title">
            <div class="mb-8">
              <h2 id="variants-title" class="text-3xl font-bold text-gray-900 mb-2">系列色號與 PBR 檔案</h2>
              <p class="text-gray-600">依系列選擇色號，並下載目前提供的 1K、2K 或 4K 材質檔。</p>
            </div>

            <div v-if="product.variants.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <article v-for="variant in product.variants" :key="variant.id" class="border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm">
                <div class="aspect-square bg-gray-50 p-4 flex items-center justify-center">
                  <img
                    :src="variant.image"
                    :alt="`${product.brand || ''} ${product.name} ${variant.code || ''} PBR 材質色號`"
                    class="max-w-full max-h-full object-contain"
                    @error="$event.target.src = 'https://placehold.co/500x500?text=No+Image'"
                  >
                </div>
                <div class="p-4 border-t border-gray-200">
                  <h3 class="font-bold text-lg text-gray-900 mb-4">{{ variant.code || '未命名色號' }}</h3>
                  <div class="grid grid-cols-3 gap-2">
                    <button
                      v-for="resolution in ['1K', '2K', '4K']"
                      :key="resolution"
                      type="button"
                      class="py-2 text-sm font-semibold border border-[#005eb8] text-[#005eb8] rounded hover:bg-[#005eb8] hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      :disabled="!variant.files?.[resolution]"
                      @click="handleDownload(variant, resolution)"
                    >
                      {{ resolution }}
                    </button>
                  </div>
                </div>
              </article>
            </div>

            <p v-else class="text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">此產品目前尚未建立可下載的系列色號。</p>
          </section>

          <section class="p-8 lg:p-12 bg-[#f9fafb] border-t border-gray-200" aria-labelledby="compatibility-title">
            <h2 id="compatibility-title" class="text-2xl font-bold text-gray-900 mb-3">PBR 材質使用方式</h2>
            <p class="text-gray-600 leading-relaxed">本站 PBR 素材可依實際檔案內容應用於 Blender、D5 Render、Enscape、Lumion、Twinmotion、Unreal Engine 與 V-Ray 等 3D 渲染工作流程。不同軟體支援的貼圖通道可能不同，使用時請依渲染引擎設定調整。</p>
          </section>
        </article>
      </template>
    </div>

    <PayModal
      :is-open="isPayModalOpen"
      :product="payTarget"
      @close="isPayModalOpen = false"
      @payment-success="onPaymentSuccess"
    />
  </main>
</template>

<style scoped>
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
</style>
