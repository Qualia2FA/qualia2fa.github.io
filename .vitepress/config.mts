import { defineConfig } from 'vitepress'

const uaRedirect = `(function () {
  try {
    if (localStorage.getItem('qualia2fa-docs-lang')) return
    if (sessionStorage.getItem('qualia2fa-docs-auto')) return
    sessionStorage.setItem('qualia2fa-docs-auto', '1')
    var tags = (navigator.languages && navigator.languages.length)
      ? navigator.languages
      : [navigator.language || '']
    var preferred = ''
    for (var i = 0; i < tags.length && !preferred; i++) {
      var tag = String(tags[i] || '').toLowerCase()
      if (tag.indexOf('zh') === 0) preferred = 'zh'
      else if (tag.indexOf('en') === 0) preferred = 'en'
    }
    if (!preferred) preferred = 'en'
    var path = location.pathname
    var onEnglish = path === '/en' || path === '/en/' || path.indexOf('/en/') === 0
    if (preferred === 'en' && !onEnglish) {
      var toEnglish = path === '/' ? '/en/' : '/en' + path
      location.replace(toEnglish + location.search + location.hash)
    } else if (preferred === 'zh' && onEnglish) {
      var toChinese = path.replace(/^\\/en(?=\\/|$)/, '') || '/'
      location.replace(toChinese + location.search + location.hash)
    }
  } catch (error) {
    /* Language detection is an enhancement; never block the page on it. */
  }
})()`

const githubOrg = 'https://github.com/Qualia2FA'

const repoItemsZh = [
  { text: '应用本体 · Qualia2FA', link: '/repos/qualia2fa/' },
  { text: '核心库 · qualia2fa-core', link: '/repos/core/' },
  { text: '绑定层 · qualia2fa-ffi', link: '/repos/ffi/' },
  { text: '设备身份 · qualia-dik', link: '/repos/qualia-dik/' },
  { text: '传输 · qualia-transport', link: '/repos/qualia-transport/' },
  { text: '认证包裹 · qualia-bioauth', link: '/repos/qualia-bioauth/' },
  { text: 'Android 认证 · qualia-bioauth-android', link: '/repos/qualia-bioauth-android/' }
]

const repoItemsEn = [
  { text: 'Application · Qualia2FA', link: '/en/repos/qualia2fa/' },
  { text: 'Core · qualia2fa-core', link: '/en/repos/core/' },
  { text: 'Bindings · qualia2fa-ffi', link: '/en/repos/ffi/' },
  { text: 'Device identity · qualia-dik', link: '/en/repos/qualia-dik/' },
  { text: 'Transport · qualia-transport', link: '/en/repos/qualia-transport/' },
  { text: 'Auth-bound keys · qualia-bioauth', link: '/en/repos/qualia-bioauth/' },
  { text: 'Android auth · qualia-bioauth-android', link: '/en/repos/qualia-bioauth-android/' }
]

const sidebarZh = [
  {
    text: '开始',
    items: [
      { text: '项目总览', link: '/guide/' },
      { text: '安装与构建', link: '/guide/getting-started/' }
    ]
  },
  {
    text: '七个仓库',
    items: [
      { text: '应用本体 Qualia2FA', link: '/repos/qualia2fa/' },
      { text: '核心库 Qualia2FA-Core', link: '/repos/core/' },
      { text: '绑定层 Qualia2FA-FFI', link: '/repos/ffi/' },
      { text: '设备身份 QualiaDeviceIdentityKit', link: '/repos/qualia-dik/' },
      { text: '传输 QualiaTransport', link: '/repos/qualia-transport/' },
      { text: '认证包裹 QualiaBioAuth', link: '/repos/qualia-bioauth/' },
      { text: 'Android 认证 QualiaBioAuth-Android', link: '/repos/qualia-bioauth-android/' }
    ]
  }
]

const sidebarEn = [
  {
    text: 'Start here',
    items: [
      { text: 'Overview', link: '/en/guide/' },
      { text: 'Install and build', link: '/en/guide/getting-started/' }
    ]
  },
  {
    text: 'The seven repositories',
    items: [
      { text: 'Application Qualia2FA', link: '/en/repos/qualia2fa/' },
      { text: 'Core Qualia2FA-Core', link: '/en/repos/core/' },
      { text: 'Bindings Qualia2FA-FFI', link: '/en/repos/ffi/' },
      { text: 'Device identity QualiaDeviceIdentityKit', link: '/en/repos/qualia-dik/' },
      { text: 'Transport QualiaTransport', link: '/en/repos/qualia-transport/' },
      { text: 'Auth-bound keys QualiaBioAuth', link: '/en/repos/qualia-bioauth/' },
      { text: 'Android auth QualiaBioAuth-Android', link: '/en/repos/qualia-bioauth-android/' }
    ]
  }
]

const baseTheme = {
  logo: { src: '/logo.svg', alt: 'Qualia2FA' },
  siteTitle: 'Qualia2FA',
  socialLinks: [{ icon: 'github', link: githubOrg }],
  outline: { level: [2, 3] },
  editLink: {
    pattern: 'https://github.com/Qualia2FA/qualia2fa.github.io/edit/main/:path'
  },
  search: {
    provider: 'local',
    options: {
      detailedView: true
    }
  }
}

export default defineConfig({
  title: 'Qualia2FA',
  titleTemplate: ':title | Qualia2FA',
  description:
    'Serverless, non-realtime two-factor authentication: documentation for the application and its Rust libraries.',
  lang: 'zh-Hans',
  lastUpdated: true,
  cleanUrls: false,
  sitemap: {
    hostname: 'https://qualia2fa.github.io'
  },
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#091012' }],
    ['script', {}, uaRedirect]
  ],
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-Hans',
      title: 'Qualia2FA 文档',
      description:
        '无中心、不实时同步的双因素认证应用，以及支撑它的 Rust 库。安装、接入与设计约定都写在这里。',
      themeConfig: {
        ...baseTheme,
        nav: [
          { text: '总览', link: '/guide/' },
          { text: '开始', link: '/guide/getting-started/' },
          { text: '仓库', items: repoItemsZh }
        ],
        sidebar: sidebarZh,
        outline: { ...baseTheme.outline, label: '本页目录' },
        editLink: { ...baseTheme.editLink, text: '在 GitHub 上编辑此页' },
        lastUpdated: { text: '最后更新于' },
        docFooter: { prev: '上一页', next: '下一页' },
        returnToTopLabel: '回到顶部',
        sidebarMenuLabel: '目录',
        darkModeSwitchLabel: '外观',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式',
        langMenuLabel: '切换语言',
        externalLinkIcon: true,
        notFound: {
          title: '页面不存在',
          quote: '这个地址没有任何页面，检查一下链接，或者回到总览。',
          linkLabel: '回到总览',
          linkText: '返回总览'
        },
        search: {
          provider: 'local',
          options: {
            detailedView: true,
            translations: {
              button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
              modal: {
                noResultsText: '没有找到结果',
                resetButtonTitle: '清除查询',
                displayDetails: '显示详细列表',
                backButtonTitle: '返回',
                footer: {
                  selectText: '选择',
                  selectKeyAriaLabel: '回车',
                  navigateText: '切换',
                  navigateUpKeyAriaLabel: '上箭头',
                  navigateDownKeyAriaLabel: '下箭头',
                  closeText: '关闭',
                  closeKeyAriaLabel: 'Esc'
                }
              }
            }
          }
        },
        footer: {
          message: '应用 Apache-2.0 · Rust 库 LGPL-3.0-or-later',
          copyright: 'Copyright © 2026 Qualia2FA contributors'
        }
      }
    },
    en: {
      label: 'English',
      lang: 'en-US',
      link: '/en/',
      title: 'Qualia2FA Docs',
      description:
        'A serverless, non-realtime two-factor authentication application and the Rust libraries behind it. Installation, integration and design contracts.',
      themeConfig: {
        ...baseTheme,
        nav: [
          { text: 'Overview', link: '/en/guide/' },
          { text: 'Get started', link: '/en/guide/getting-started/' },
          { text: 'Repositories', items: repoItemsEn }
        ],
        sidebar: sidebarEn,
        outline: { ...baseTheme.outline, label: 'On this page' },
        editLink: { ...baseTheme.editLink, text: 'Edit this page on GitHub' },
        lastUpdated: { text: 'Last updated' },
        docFooter: { prev: 'Previous', next: 'Next' },
        returnToTopLabel: 'Return to top',
        sidebarMenuLabel: 'Menu',
        darkModeSwitchLabel: 'Appearance',
        lightModeSwitchTitle: 'Switch to light mode',
        darkModeSwitchTitle: 'Switch to dark mode',
        langMenuLabel: 'Change language',
        externalLinkIcon: true,
        notFound: {
          title: 'Page not found',
          quote: 'There is nothing at this address. Check the link, or go back to the overview.',
          linkLabel: 'Go to overview',
          linkText: 'Back to overview'
        },
        search: {
          provider: 'local',
          options: {
            detailedView: true,
            translations: {
              button: { buttonText: 'Search docs', buttonAriaLabel: 'Search docs' },
              modal: {
                noResultsText: 'No results found',
                resetButtonTitle: 'Reset search',
                displayDetails: 'Display detailed list',
                backButtonTitle: 'Back',
                footer: {
                  selectText: 'Select',
                  selectKeyAriaLabel: 'Enter',
                  navigateText: 'Navigate',
                  navigateUpKeyAriaLabel: 'Up arrow',
                  navigateDownKeyAriaLabel: 'Down arrow',
                  closeText: 'Close',
                  closeKeyAriaLabel: 'Escape'
                }
              }
            }
          }
        },
        footer: {
          message: 'Application Apache-2.0 · Rust libraries LGPL-3.0-or-later',
          copyright: 'Copyright © 2026 Qualia2FA contributors'
        }
      }
    }
  }
})
