<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useData, useRoute } from 'vitepress'

defineProps<{ mobile?: boolean }>()

const route = useRoute()
const { lang } = useData()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const isEnglish = computed(
  () => lang.value.toLowerCase().startsWith('en') || route.path.startsWith('/en/')
)

const currentLabel = computed(() => (isEnglish.value ? 'English' : '简体中文'))

function close() {
  open.value = false
}

function onDocumentPointer(event: PointerEvent) {
  if (!open.value) return
  if (root.value && !root.value.contains(event.target as Node)) close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointer)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointer)
  document.removeEventListener('keydown', onKeydown)
})

watch(() => route.path, close)

function followBrowser() {
  try {
    localStorage.removeItem('qualia2fa-docs-lang')
    sessionStorage.removeItem('qualia2fa-docs-auto')
  } catch {
    /* Storage can be unavailable; reloading still re-runs the detection. */
  }
  window.location.reload()
}

function choose(target: 'zh' | 'en') {
  close()
  try {
    localStorage.setItem('qualia2fa-docs-lang', target)
    sessionStorage.setItem('qualia2fa-docs-auto', '1')
  } catch {
    /* The navigation below is what matters; the preference is best effort. */
  }

  const path = window.location.pathname
  let next: string
  if (target === 'en') {
    next = path === '/' ? '/en/' : '/en' + path.replace(/^\/en(?=\/|$)/, '')
  } else {
    next = path.replace(/^\/en(?=\/|$)/, '') || '/'
  }
  window.location.href = next + window.location.search + window.location.hash
}
</script>

<template>
  <div ref="root" class="q-lang" :class="{ 'q-lang--mobile': mobile }">
    <button
      type="button"
      class="q-lang__button"
      :aria-label="isEnglish ? 'Change language' : '切换语言'"
      :aria-expanded="open"
      aria-haspopup="true"
      @click="open = !open"
    >
      <svg class="q-lang__globe" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.6 2.5 4 5.6 4 9s-1.4 6.5-4 9c-2.6-2.5-4-5.6-4-9s1.4-6.5 4-9z" />
      </svg>
      <span class="q-lang__label">{{ currentLabel }}</span>
      <svg class="q-lang__chevron" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <div v-if="open" class="q-lang__menu" role="menu">
      <button type="button" role="menuitem" class="q-lang__item" @click="choose('zh')">
        <span>简体中文</span>
        <svg v-if="!isEnglish" class="q-lang__check" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m5 12 4.5 4.5L19 7" />
        </svg>
      </button>
      <button type="button" role="menuitem" class="q-lang__item" @click="choose('en')">
        <span>English</span>
        <svg v-if="isEnglish" class="q-lang__check" viewBox="0 0 24 24" aria-hidden="true">
          <path d="m5 12 4.5 4.5L19 7" />
        </svg>
      </button>
      <button type="button" role="menuitem" class="q-lang__item q-lang__item--auto" @click="followBrowser">
        <span>{{ isEnglish ? 'Follow browser language' : '跟随浏览器语言' }}</span>
      </button>
    </div>
  </div>
</template>
