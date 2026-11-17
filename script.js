/* =========================================================================
   EduPulse - online learning site
   --------------------------------------------------------------------------
   All pages live in index.html as <template> elements. Only ONE page is
   mounted at a time, so element ids and page scripts never clash. Navigation
   uses the shared site menu, contextual links, and URL hashes (#p01 ... #p25).

   Each page's original inline <script> is kept inside PAGES below, wrapped in
   init(document). Inside init, `document` is a proxy whose queries are limited
   to the mounted page. While a page is mounted, its document/window listeners
   and timers are tracked and removed again when you leave the page.
   ========================================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     1. Sandbox: track listeners and timers created by the active page
     --------------------------------------------------------------------- */
  var epActive = null;                                   // sandbox of the mounted page
  var selectedCourseCategory = '';
  var selectedCourseQuery = '';
  var epQuizPaused = false;
  var epQuizQuestion = 1;
  var epRealAdd = EventTarget.prototype.addEventListener;
  var epRealElementAdd = Element.prototype.addEventListener;
  var epRealRemove = EventTarget.prototype.removeEventListener;
  var epRealSetTimeout = window.setTimeout;
  var epRealSetInterval = window.setInterval;
  var epRealClearTimeout = window.clearTimeout;
  var epRealClearInterval = window.clearInterval;

  Element.prototype.addEventListener = function (type, listener, options) {
    if (epActive && type === 'click' && this.matches && this.matches('button, a')) {
      this.setAttribute('data-ep-bound', 'true');
    }
    return epRealElementAdd.call(this, type, listener, options);
  };

  function epGuardTarget(target) {
    target.addEventListener = function (type, listener, options) {
      if (!epActive) {
        return epRealAdd.call(target, type, listener, options);
      }
      var ready = (type === 'DOMContentLoaded' && document.readyState !== 'loading') ||
                  (type === 'load' && document.readyState === 'complete');
      if (ready) {
        // The page scripts run after the document has already loaded, so run
        // these handlers right after the current page init finishes.
        var owner = epActive;
        queueMicrotask(function () {
          if (owner === epActive) listener.call(target, new Event(type));
        });
        return;
      }
      epRealAdd.call(target, type, listener, options);
      epActive.listeners.push([target, type, listener, options]);
    };
  }
  epGuardTarget(document);
  epGuardTarget(window);

  window.setTimeout = function () {
    var id = epRealSetTimeout.apply(window, arguments);
    if (epActive) epActive.timers.push(id);
    return id;
  };
  window.setInterval = function () {
    var id = epRealSetInterval.apply(window, arguments);
    if (epActive) epActive.timers.push(id);
    return id;
  };

  /* A `document` stand-in for page scripts: queries only search the mounted page. */
  function epScopedDocument(root) {
    return new Proxy(document, {
      get: function (target, prop) {
        switch (prop) {
          case 'getElementById':
            return function (id) { return root.querySelector('#' + CSS.escape(String(id))); };
          case 'querySelector':
            return function (sel) { return root.querySelector(sel); };
          case 'querySelectorAll':
            return function (sel) { return root.querySelectorAll(sel); };
          case 'getElementsByClassName':
            return function (name) { return root.getElementsByClassName(name); };
          case 'getElementsByTagName':
            return function (name) { return root.getElementsByTagName(name); };
          default:
            var value = target[prop];
            return typeof value === 'function' ? value.bind(target) : value;
        }
      },
      set: function (target, prop, value) {
        target[prop] = value;
        return true;
      }
    });
  }

  /* ---------------------------------------------------------------------
     2. Page registry. Each entry is the original page script.
        expose = functions that inline onclick="..." attributes call.
     --------------------------------------------------------------------- */
  var PAGES = {
    '01': {
      expose: [],
      init: function (document) {
  updateCartCount(this, readCart().length);
  document.querySelectorAll('section button').forEach(button => {
    button.addEventListener('click', function () {
      const text = buttonLabel(this);
      const searchInput = document.getElementById('course-search-input');
      if (searchInput && ['Python', 'UI/UX Дизайн', 'AI & Prompt', 'Data Science', 'Бизнес төсөл'].includes(text)) {
        selectedCourseQuery = text;
        go('03', true);
        return;
      }

      if (/bookmark_add|хадгалах/i.test(text)) {
        const saved = this.getAttribute('aria-pressed') !== 'true';
        setPressed(this, saved);
        const icon = this.querySelector('.material-symbols-outlined');
        if (icon) icon.textContent = saved ? 'bookmark' : 'bookmark_add';
        notify(saved ? 'Сургалтыг хадгаллаа.' : 'Хадгалсан жагсаалтаас хаслаа.');
        return;
      }

      if (/сургалт|кодчилол|дизайн|ai & data|бүх ангилал|^бүгд$/i.test(text)) {
        selectedCourseCategory = /^бүгд$|бүх ангилал/i.test(text) ? '' : text;
        selectedCourseQuery = '';
        go('03', true);
        return;
      }

      if (/^хайх$/i.test(text) && searchInput) {
        selectedCourseQuery = searchInput.value.trim();
        go('03', true);
        return;
      }

      const destination = contextualRoute(this, text);
      if (destination) go(destination, true);
      else notify(text + ' үйлдлийг хийлээ.');
    });
  });
      }
    },
    '02': {
      expose: ['handleAuthSubmit', 'togglePasswordVisibility', 'toggleAuthMode'],
      init: function (document) {
    let currentMode = 'login';

    function setAuthMode(mode) {
      currentMode = mode;
      const tabLogin = document.getElementById('tab-login');
      const tabSignup = document.getElementById('tab-signup');
      const fieldFullname = document.getElementById('field-fullname');
      const formHeading = document.getElementById('form-heading');
      const formSubheading = document.getElementById('form-subheading');
      const btnSubmit = document.getElementById('btn-submit');
      const linkForgot = document.getElementById('link-forgot');
      const termsHint = document.getElementById('terms-hint');
      const labelRemember = document.getElementById('label-remember');
      const footerPrompt = document.getElementById('footer-prompt');
      const btnToggleMode = document.getElementById('btn-toggle-mode');
      const inputFullname = document.getElementById('input-fullname');
      const authAlert = document.getElementById('auth-alert');

      if (mode === 'signup') {
        tabLogin.className = "py-2 text-center rounded-md font-label-md text-label-md font-medium text-on-surface-variant hover:text-primary transition-all";
        tabSignup.className = "py-2 text-center rounded-md font-label-md text-label-md font-bold transition-all bg-primary text-on-primary shadow-sm";
        
        fieldFullname.classList.remove('hidden');
        inputFullname.required = true;
        linkForgot.classList.add('hidden');
        termsHint.classList.remove('hidden');
        labelRemember.textContent = "Шинэчлэлтүүд авах";

        formHeading.textContent = "Бүртгэл үүсгэх";
        formSubheading.textContent = "EduPulse-д нэгдэн шилдэг технологийн боловсрол эзэмшээрэй.";
        btnSubmit.innerHTML = '<span>Бүртгүүлэх</span><span class="material-symbols-outlined text-[20px]">person_add</span>';
        
        footerPrompt.textContent = "Бүртгэлтэй хаяг байгаа юу?";
        btnToggleMode.textContent = "Нэвтрэх";
      } else {
        tabSignup.className = "py-2 text-center rounded-md font-label-md text-label-md font-medium text-on-surface-variant hover:text-primary transition-all";
        tabLogin.className = "py-2 text-center rounded-md font-label-md text-label-md font-bold transition-all bg-primary text-on-primary shadow-sm";
        
        fieldFullname.classList.add('hidden');
        inputFullname.required = false;
        linkForgot.classList.remove('hidden');
        termsHint.classList.add('hidden');
        labelRemember.textContent = "Намайг санах";

        formHeading.textContent = "Тавтай морилно уу";
        formSubheading.textContent = "Өөрийн хувийн эрхээр системд нэвтэрч сургалтаа үргэлжлүүлнэ үү.";
        btnSubmit.innerHTML = '<span>Нэвтрэх</span><span class="material-symbols-outlined text-[20px]">arrow_forward</span>';
        
        footerPrompt.textContent = "Шинэ хэрэглэгч үү?";
        btnToggleMode.textContent = "Бүртгэл үүсгэх";
      }
      authAlert.classList.add('hidden');
    }

    window.toggleAuthMode = toggleAuthMode;
    function toggleAuthMode() {
      setAuthMode(currentMode === 'login' ? 'signup' : 'login');
    }

    document.getElementById('tab-login').addEventListener('click', () => setAuthMode('login'));
    document.getElementById('tab-signup').addEventListener('click', () => setAuthMode('signup'));

    window.togglePasswordVisibility = togglePasswordVisibility;
    function togglePasswordVisibility() {
      const pwdInput = document.getElementById('input-password');
      const pwdIcon = document.getElementById('pwd-icon');
      if (pwdInput.type === 'password') {
        pwdInput.type = 'text';
        pwdIcon.textContent = 'visibility_off';
      } else {
        pwdInput.type = 'password';
        pwdIcon.textContent = 'visibility';
      }
    }

    window.handleAuthSubmit = handleAuthSubmit;
    function handleAuthSubmit() {
      const alert = document.getElementById('auth-alert');
      // Өмнөх хуурамч амжилтын мессежийг API холбогдох хүртэл ашиглахгүй.
      alert.textContent = currentMode === 'login'
        ? 'ДЕМО: Нэвтрэх хүсэлт шалгагдсангүй. API холбогдоогүй тул та нэвтрээгүй, мэдээлэл илгээгдээгүй.'
        : 'ДЕМО: Бүртгэлийн талбаруудыг шалгалаа. API холбогдоогүй тул бүртгэл үүсээгүй, мэдээлэл хадгалагдаагүй.';
      alert.classList.remove('hidden');
    }

    document.getElementById('link-forgot').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const alert = document.getElementById('auth-alert');
      alert.textContent = 'ДЕМО: Нууц үг сэргээх API холбогдоогүй тул хүсэлт илгээгдсэнгүй.';
      alert.classList.remove('hidden');
    });

    document.querySelectorAll('#auth-form + div + div button[type="button"]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const provider = button.textContent.trim();
        const alert = document.getElementById('auth-alert');
        alert.textContent = 'ДЕМО: ' + provider + ' нэвтрэлт холбогдоогүй тул нэвтрэх боломжгүй.';
        alert.classList.remove('hidden');
      });
    });
  
      }
    },
    '03': {
      expose: [],
      init: function (document) {
    document.addEventListener('DOMContentLoaded', () => {
      const mobileTrigger = document.getElementById('mobile-filter-trigger');
      const sidebar = document.getElementById('filter-sidebar');
      
      if (mobileTrigger && sidebar) {
        mobileTrigger.addEventListener('click', () => {
          sidebar.classList.toggle('hidden');
          if (!sidebar.classList.contains('hidden')) {
            sidebar.scrollIntoView({ behavior: 'smooth' });
          }
        });
      }
    });

    if (selectedCourseCategory || selectedCourseQuery) {
      var category = selectedCourseCategory.toLowerCase();
      if (category === 'кодчилол') category = 'хөгжүүлэлт';
      else if (category === 'дизайн') category = 'дизайн';
      else if (category === 'ai & data') category = 'өгөгдөл';
      var query = selectedCourseQuery || category;
      var searchInput = document.querySelector('input[placeholder*="Хичээлийн нэр"]');
      if (searchInput) searchInput.value = query;
      filterVisibleItems(query.toLowerCase());
    }
  
      }
    },
    '04': {
      expose: ['toggleModule'],
      init: function (document) {
  window.toggleModule = toggleModule;
  function toggleModule(id) {
    const content = document.getElementById(`content-mod-${id}`);
    const icon = document.getElementById(`icon-mod-${id}`);
    if (!content || !icon) return;

    if (content.classList.contains('hidden')) {
      content.classList.remove('hidden');
      icon.style.transform = 'rotate(180deg)';
    } else {
      content.classList.add('hidden');
      icon.style.transform = 'rotate(0deg)';
    }
  }

  toggleModule(1);

  const toggleBtn = document.getElementById('toggle-all-curriculum');
  let allOpen = false;
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      allOpen = !allOpen;
      for (let i = 1; i <= 5; i++) {
        const content = document.getElementById(`content-mod-${i}`);
        const icon = document.getElementById(`icon-mod-${i}`);
        if (content && icon) {
          if (allOpen) {
            content.classList.remove('hidden');
            icon.style.transform = 'rotate(180deg)';
          } else {
            content.classList.add('hidden');
            icon.style.transform = 'rotate(0deg)';
          }
        }
      }
      toggleBtn.querySelector('span:last-child').textContent = allOpen ? 'Бүгдийг хураах' : 'Бүгдийг дэлгэх';
    });
  }

  const timerElem = document.getElementById('countdown-timer');
  if (timerElem) {
    let seconds = 51725;
    setInterval(() => {
      if (seconds > 0) {
        seconds--;
        const d = Math.floor(seconds / (3600 * 24));
        const h = Math.floor((seconds % (3600 * 24)) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        timerElem.textContent = `0${d} өдөр ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      }
    }, 1000);
  }
      }
    },
    '05': {
      expose: ['switchTab', 'toggleCompleted'],
      init: function (document) {
      window.switchTab = switchTab;
      function switchTab(tabId) {
        const tabs = ['notes', 'assignment', 'qa', 'privatenotes'];
        tabs.forEach(id => {
          const content = document.getElementById('tabContent-' + id);
          const btn = document.getElementById('tabBtn-' + id);
          if (!content || !btn) return;
          
          if (id === tabId) {
            content.classList.remove('hidden');
            btn.className = 'px-4 py-3 text-xs font-bold text-blue-700 bg-white border-t-2 border-blue-600 rounded-t-xl transition-colors flex items-center gap-2 whitespace-nowrap shadow-xs';
          } else {
            content.classList.add('hidden');
            btn.className = 'px-4 py-3 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-t-xl transition-colors flex items-center gap-2 whitespace-nowrap';
          }
        });
      }

      window.toggleCompleted = toggleCompleted;
      function toggleCompleted(btn) {
        const isCompleted = btn.getAttribute('data-completed') === 'true';
        if (!isCompleted) {
          btn.setAttribute('data-completed', 'true');
          btn.innerHTML = '<span class="material-symbols-outlined text-[19px]">verified</span><span>Амжилттай дууссан! ✔</span>';
          btn.className = 'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 transition-all shadow-xs text-xs font-bold';
        } else {
          btn.setAttribute('data-completed', 'false');
          btn.innerHTML = '<span class="material-symbols-outlined text-[19px]">check_circle</span><span>Хичээл дуусгасан гэж тэмдэглэх</span>';
          btn.className = 'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm shadow-emerald-500/30 text-xs font-bold';
        }
      }

      }
    },
    '07': {
      expose: [],
      init: function (document) {
// (no script on this page)
      }
    },
    '08': {
      expose: ['submitAssignment', 'runSandboxTests', 'hideToast'],
      init: function (document) {
    window.runSandboxTests = runSandboxTests;
    function runSandboxTests() {
      const btn = document.getElementById('testRunnerBtn');
      const terminal = document.getElementById('terminalConsole');
      const timer = document.getElementById('terminalTime');
      
      const originalText = btn.innerHTML;
      btn.innerHTML = `<span class="material-symbols-outlined text-[18px] animate-spin">refresh</span> Шалгаж байна...`;
      btn.disabled = true;

      terminal.innerHTML += `\n<p class="text-primary font-semibold">&gt; [${new Date().toLocaleTimeString()}] Triggering fresh CI/CD runner container...</p>`;
      terminal.scrollTop = terminal.scrollHeight;

      setTimeout(() => {
        terminal.innerHTML += `<p class="text-outline">&gt; Spawning isolated Redis 7.2 instance...</p>`;
        terminal.innerHTML += `<p class="text-on-surface">&gt; Concurrency check (Worker: 5): PASS [500 jobs / 0.89s]</p>`;
        terminal.innerHTML += `<p class="text-primary font-bold">&gt; Finished: 12 unit tests, 0 leaks, 0 errors. Status: OK.</p>`;
        terminal.scrollTop = terminal.scrollHeight;
        
        timer.innerText = `${Math.floor(Math.random() * 80 + 150)}ms runtime`;
        btn.innerHTML = originalText;
        btn.disabled = false;
      }, 1200);
    }

    window.submitAssignment = submitAssignment;
    function submitAssignment() {
      const toast = document.getElementById('successToast');
      toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
      toast.classList.add('translate-y-0', 'opacity-100');

      setTimeout(() => {
        hideToast();
      }, 6000);
    }

    window.hideToast = hideToast;
    function hideToast() {
      const toast = document.getElementById('successToast');
      toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
      toast.classList.remove('translate-y-0', 'opacity-100');
    }

    document.getElementById('runTestsBtn').addEventListener('click', runSandboxTests);
  
      }
    },
    '09': {
      expose: [],
      init: function (document) {
// (no script on this page)
      }
    },
    '10': {
      expose: [],
      init: function () {
        renderCartPage(this);
      }
    },
    '11': {
      expose: [],
      init: function (document) {
    (function() {
      const copyBtn = document.getElementById('copy-lottery-btn');
      const downloadBtn = document.getElementById('download-receipt-btn');
      const toast = document.getElementById('toast-notification');
      const toastText = document.getElementById('toast-text');

      function showToast(message) {
        if (!toast || !toastText) return;
        toastText.textContent = message;
        toast.classList.remove('translate-y-20', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
        setTimeout(() => {
          toast.classList.remove('translate-y-0', 'opacity-100');
          toast.classList.add('translate-y-20', 'opacity-0');
        }, 2500);
      }

      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText('83910248').then(() => {
            showToast('Сугалааны дугаар хуулагдлаа: 83910248');
          }).catch(() => {
            showToast('Хуулахад алдаа гарлаа');
          });
        });
      }

      if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
          showToast('Нэхэмжлэх файл (.PDF) татаж байна...');
        });
      }
    })();
  
      }
    },
    '12': {
      expose: [],
      init: function (document) {
  // Dynamic Heatmap Generation (52 weeks x 7 days)
  (function initHeatmap() {
    const grid = document.getElementById('heatmapGrid');
    if (!grid) return;
    
    // Deterministic procedural weights to emulate authentic coding bursts
    const intensityClasses = [
      'bg-surface-container',       // 0: no commits
      'bg-surface-container-high',  // 1: low
      'bg-surface-container-highest',// 2: medium
      'bg-on-surface-variant',      // 3: heavy
      'bg-primary'                  // 4: super active
    ];

    const totalDays = 52 * 7;
    let html = '';

    for (let i = 0; i < totalDays; i++) {
      // Create pattern clusters
      let rand = Math.sin(i * 0.18) * 0.5 + Math.cos(i * 0.05) * 0.5;
      let level = 0;
      if (rand > 0.55) level = 4;
      else if (rand > 0.3) level = 3;
      else if (rand > 0.0) level = 2;
      else if (rand > -0.3) level = 1;
      else level = 0;

      // Ensure some days in latest month are highly active
      if (i > totalDays - 28 && Math.random() > 0.4) {
        level = Math.max(level, 3);
      }

      html += `<div class="w-2.5 h-2.5 rounded-sm ${intensityClasses[level]} hover:scale-125 transition-transform cursor-pointer" title="Өдөр ${i + 1}: ${level * 3 + (level > 0 ? 1 : 0)} коммит"></div>`;
    }

    grid.innerHTML = html;
  })();

  // Toast notification helper
  function showToast(msg) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMessage');
    if (!toast || !toastMsg) return;

    toastMsg.textContent = msg;
    toast.classList.remove('translate-y-16', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
      toast.classList.add('translate-y-16', 'opacity-0');
      toast.classList.remove('translate-y-0', 'opacity-100');
    }, 3000);
  }

  // Interactive buttons
  document.getElementById('exportPdfBtn')?.addEventListener('click', () => {
    showToast('Сурлагын албан ёсны PDF тайлан татагдаж байна...');
  });

  document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
    showToast('Аналитикийн түүхий өгөгдөл CSV хэлбэрээр татагдлаа.');
  });

  document.getElementById('shareLinkBtn')?.addEventListener('click', () => {
    showToast('Баталгаажуулах линк санах ойд хуулагдлаа: edupulse.mn/verify/temuulen-482');
  });

  document.getElementById('copyPublicLinkBtn')?.addEventListener('click', () => {
    showToast('Портфолио линк хуулагдлаа: edupulse.mn/profile/temuulen');
  });

  document.getElementById('linkedinShareBtn')?.addEventListener('click', () => {
    showToast('LinkedIn сертификат баталгаажуулах хуудас руу шилжиж байна...');
  });
      }
    },
    '13': {
      expose: [],
      init: function (document) {
    (function() {
      const monthlyBtn = document.getElementById('monthlyBtn');
      const yearlyBtn = document.getElementById('yearlyBtn');
      const premiumPrice = document.getElementById('premiumPrice');
      const premiumPeriod = document.getElementById('premiumPeriod');
      const ultraPrice = document.getElementById('ultraPrice');
      const ultraPeriod = document.getElementById('ultraPeriod');
      const ultraSubtext = document.getElementById('ultraSubtext');
      const entPrice = document.getElementById('entPrice');
      const entPeriod = document.getElementById('entPeriod');

      let isYearly = false;

      function updatePricing() {
        if (isYearly) {
          monthlyBtn.className = "px-space-md py-2 rounded-lg font-title-md text-title-md text-on-surface-variant hover:text-on-surface transition-all duration-200";
          yearlyBtn.className = "px-space-md py-2 rounded-lg font-title-md text-title-md text-on-primary bg-primary shadow-sm transition-all duration-200 flex items-center gap-space-xs";
          premiumPrice.textContent = "₮4,800,000";
          premiumPeriod.textContent = "/ жил";
          ultraPrice.textContent = "₮6,240,000";
          ultraPeriod.textContent = "/ жил";
          ultraSubtext.textContent = "Сард ₮520,000 болж хэмнэгдэнэ";
          entPrice.textContent = "₮1,824,000";
          entPeriod.textContent = "/ хэрэглэгч / жил";
        } else {
          yearlyBtn.className = "px-space-md py-2 rounded-lg font-title-md text-title-md text-on-surface-variant hover:text-on-surface transition-all duration-200 flex items-center gap-space-xs";
          monthlyBtn.className = "px-space-md py-2 rounded-lg font-title-md text-title-md text-on-primary bg-primary shadow-sm transition-all duration-200";
          premiumPrice.textContent = "₮500,000";
          premiumPeriod.textContent = "/ сар";
          ultraPrice.textContent = "₮650,000";
          ultraPeriod.textContent = "/ сар";
          ultraSubtext.textContent = "Сар бүр төлөлт хийгдэх нөхцөлтэй";
          entPrice.textContent = "₮190,000";
          entPeriod.textContent = "/ хэрэглэгч / сар";
        }
      }

      monthlyBtn.addEventListener('click', function() {
        isYearly = false;
        updatePricing();
      });

      yearlyBtn.addEventListener('click', function() {
        isYearly = true;
        updatePricing();
      });

      // Accordion functionality
      const toggles = document.querySelectorAll('.faq-toggle');
      toggles.forEach(function(toggle) {
        toggle.addEventListener('click', function() {
          const content = this.nextElementSibling;
          const icon = this.querySelector('.faq-icon');
          const isHidden = content.classList.contains('hidden');

          // Close all others
          document.querySelectorAll('.faq-content').forEach(function(el) {
            el.classList.add('hidden');
          });
          document.querySelectorAll('.faq-icon').forEach(function(el) {
            el.classList.remove('rotate-180');
          });

          if (isHidden) {
            content.classList.remove('hidden');
            icon.classList.add('rotate-180');
          }
        });
      });
    })();
  
      }
    },
    '14': {
      expose: ['downloadInvoice', 'submitOrgInvoice'],
      init: function (document) {
  window.downloadInvoice = downloadInvoice;
  function downloadInvoice(invoiceId) {
    const originalText = event.currentTarget.innerHTML;
    const button = event.currentTarget;
    button.innerHTML = '<span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span><span>Татаж байна...</span>';
    button.disabled = true;

    setTimeout(() => {
      button.innerHTML = '<span class="material-symbols-outlined text-[16px]">check</span><span>Татагдлаа</span>';
      setTimeout(() => {
        button.innerHTML = originalText;
        button.disabled = false;
      }, 1500);
    }, 900);
  }

  window.submitOrgInvoice = submitOrgInvoice;
  function submitOrgInvoice() {
    const btn = document.getElementById('submitInvoiceBtn');
    const toast = document.getElementById('formSuccessToast');
    const regInput = document.getElementById('orgRegisterInput');
    const nameInput = document.getElementById('orgNameInput');
    const emailInput = document.getElementById('orgEmailInput');

    if (!regInput.value || !nameInput.value || !emailInput.value) {
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-[20px] animate-spin">progress_activity</span><span>Илгээж байна...</span>';

    setTimeout(() => {
      btn.innerHTML = '<span class="material-symbols-outlined text-[20px]">done_all</span><span>Амжилттай илгээгдлээ</span>';
      toast.classList.remove('hidden');
      
      setTimeout(() => {
        btn.disabled = false;
        btn.innerHTML = '<span class="material-symbols-outlined text-[20px]">send</span><span>Нэхэмжлэх хүсэлт илгээх</span>';
        document.getElementById('orgInvoiceForm').reset();
        setTimeout(() => {
          toast.classList.add('hidden');
        }, 4000);
      }, 2000);
    }, 800);
  }

  // Interactive Tax Lookup Mock
  document.getElementById('lookupTaxBtn')?.addEventListener('click', function() {
    const reg = document.getElementById('orgRegisterInput').value.trim();
    const nameInput = document.getElementById('orgNameInput');
    if (!reg) {
      alert('Компанийн регистрийн дугаараа оруулна уу.');
      return;
    }
    this.innerText = 'Хайж байна...';
    setTimeout(() => {
      this.innerText = 'Шалгах';
      if (reg.length >= 7) {
        nameInput.value = 'Монгол Тех Сервис ХХК (Татварт бүртгэлтэй)';
      } else {
        alert('Хүчинтэй регистрийн дугаар оруулна уу.');
      }
    }, 500);
  });

  // Client Filter simulation
  const filterBtns = document.querySelectorAll('.filter-btn');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', function() {
      filterBtns.forEach(b => {
        b.classList.remove('bg-primary', 'text-on-primary', 'font-semibold');
        b.classList.add('bg-surface-container', 'text-on-surface-variant', 'font-medium');
      });
      this.classList.remove('bg-surface-container', 'text-on-surface-variant', 'font-medium');
      this.classList.add('bg-primary', 'text-on-primary', 'font-semibold');
    });
  });

  // Real-time table search simulation
  const searchInput = document.getElementById('searchInvoiceInput');
  searchInput?.addEventListener('keyup', function(e) {
    const query = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#transactionTableBody tr');
    rows.forEach(row => {
      const text = row.innerText.toLowerCase();
      if (text.includes(query)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  });

  // Quick statements export
  document.getElementById('exportStatementBtn')?.addEventListener('click', function() {
    const btn = this;
    const initial = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">sync</span><span>Бэлтгэж байна...</span>';
    setTimeout(() => {
      btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">check</span><span>CSV бэлэн боллоо</span>';
      setTimeout(() => {
        btn.innerHTML = initial;
      }, 1800);
    }, 700);
  });

  // Add Card trigger
  document.getElementById('addCardBtn')?.addEventListener('click', function() {
    alert('Карт холбох найдвартай төлбөрийн цонх нээгдэж байна. (3D Secure 2.0)');
  });
      }
    },
    '15': {
      expose: [],
      init: function (document) {
    (function() {
      let currentStep = 1;
      const totalSteps = 4;

      const wizardTabs = document.querySelectorAll('.step-btn');
      const stepPanes = document.querySelectorAll('.step-pane');
      const prevBtn = document.getElementById('prevStepBtn');
      const nextBtn = document.getElementById('nextStepBtn');
      const stepCounter = document.getElementById('stepCounterText');
      const topPublishBtn = document.getElementById('topPublishBtn');
      const finalPublishBtn = document.getElementById('finalPublishBtn');
      const saveDraftBtn = document.getElementById('saveDraftBtn');

      function updateStep(newStep) {
        if (newStep < 1 || newStep > totalSteps) return;
        currentStep = newStep;

        // Hide all panes
        stepPanes.forEach((pane, idx) => {
          if (idx + 1 === currentStep) {
            pane.classList.remove('hidden');
          } else {
            pane.classList.add('hidden');
          }
        });

        // Update tabs styling
        wizardTabs.forEach((tab) => {
          const s = parseInt(tab.getAttribute('data-step'), 10);
          const numBadge = tab.querySelector('.step-num');
          const title = tab.querySelector('.font-title-md');

          if (s === currentStep) {
            tab.classList.add('bg-surface-container');
            numBadge.className = 'step-num w-7 h-7 rounded-xl bg-primary text-on-primary font-headline-sm text-xs flex items-center justify-center font-bold';
            title.className = 'font-title-md text-title-md text-primary truncate';
          } else if (s < currentStep) {
            tab.classList.remove('bg-surface-container');
            numBadge.className = 'step-num w-7 h-7 rounded-xl bg-primary text-on-primary font-headline-sm text-xs flex items-center justify-center font-bold';
            title.className = 'font-title-md text-title-md text-surface-tint truncate';
          } else {
            tab.classList.remove('bg-surface-container');
            numBadge.className = 'step-num w-7 h-7 rounded-xl bg-surface-container-high text-secondary group-hover:text-primary font-headline-sm text-xs flex items-center justify-center font-bold';
            title.className = 'font-title-md text-title-md text-secondary group-hover:text-primary truncate';
          }
        });

        // Update Prev button
        if (currentStep === 1) {
          prevBtn.disabled = true;
          prevBtn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
          prevBtn.disabled = false;
          prevBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }

        // Update Next button
        if (currentStep === totalSteps) {
          nextBtn.innerHTML = 'Нийтлэх <span class="material-symbols-outlined text-base">rocket_launch</span>';
        } else {
          nextBtn.innerHTML = 'Дараах алхам <span class="material-symbols-outlined text-base">arrow_forward</span>';
        }

        // Counter text
        if (stepCounter) {
          stepCounter.textContent = 'Алхам ' + currentStep + ' / ' + totalSteps;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
      }

      // Tab clicks
      wizardTabs.forEach(tab => {
        tab.addEventListener('click', () => {
          const step = parseInt(tab.getAttribute('data-step'), 10);
          updateStep(step);
        });
      });

      // Prev / Next actions
      prevBtn.addEventListener('click', () => {
        if (currentStep > 1) updateStep(currentStep - 1);
      });

      nextBtn.addEventListener('click', () => {
        if (currentStep < totalSteps) {
          updateStep(currentStep + 1);
        } else {
          alert('Сургалт амжилттай нийтлэгдлээ!');
        }
      });

      topPublishBtn.addEventListener('click', () => updateStep(4));
      finalPublishBtn.addEventListener('click', () => {
        alert('Баяр хүргэе! Сургалт амжилттай нийтлэгдэж суралцагчдад нээлттэй боллоо.');
      });

      saveDraftBtn.addEventListener('click', () => {
        const originalText = saveDraftBtn.innerHTML;
        saveDraftBtn.innerHTML = '<span class="material-symbols-outlined text-base">check</span> Хадгалагдлаа';
        setTimeout(() => {
          saveDraftBtn.innerHTML = originalText;
        }, 1800);
      });
    })();
  
      }
    },
    '16': {
      expose: [],
      init: function (document) {
  (function() {
    // Interactive Modal Controller
    const modal = document.getElementById('new-topic-modal');
    const modalCard = document.getElementById('modal-card');
    const openBtns = [
      document.getElementById('open-new-topic-btn'),
      document.getElementById('open-new-topic-btn-side')
    ];
    const closeBtn = document.getElementById('close-modal-btn');
    const cancelBtn = document.getElementById('cancel-modal-btn');
    const publishBtn = document.getElementById('publish-topic-btn');

    function openModal() {
      if (!modal) return;
      modal.classList.remove('hidden');
      setTimeout(() => {
        modal.classList.remove('opacity-0');
        modalCard.classList.remove('scale-95');
        modalCard.classList.add('scale-100');
      }, 10);
    }

    function closeModal() {
      if (!modal) return;
      modal.classList.add('opacity-0');
      modalCard.classList.remove('scale-100');
      modalCard.classList.add('scale-95');
      setTimeout(() => {
        modal.classList.add('hidden');
      }, 200);
    }

    openBtns.forEach(btn => {
      if (btn) btn.addEventListener('click', openModal);
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (publishBtn) {
      publishBtn.addEventListener('click', () => {
        alert('Таны хэлэлцүүлэг амжилттай нийтлэгдлээ!');
        closeModal();
      });
    }

    // Modal background click close
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    }

    // Upvote / Downvote interactive micro-counter
    const voteButtons = document.querySelectorAll('.vote-btn');
    voteButtons.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        const parent = this.closest('div');
        const countSpan = parent.querySelector('span.font-title-md');
        if (!countSpan) return;
        let current = parseInt(countSpan.textContent, 10) || 0;
        const type = this.getAttribute('data-vote');
        
        if (type === 'up') {
          if (!this.classList.contains('text-primary')) {
            current += 1;
            this.classList.add('text-primary');
          } else {
            current -= 1;
            this.classList.remove('text-primary');
          }
        } else if (type === 'down') {
          current = Math.max(0, current - 1);
        }
        countSpan.textContent = current;
      });
    });

    // Keyboard shortcut for Cmd+K search focus
    window.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('forum-search-input');
        if (searchInput) searchInput.focus();
      }
    });
  })();
      }
    },
    '17': {
      expose: [],
      init: function (document) {
// (no script on this page)
      }
    },
    '18': {
      expose: ['toggleFlag', 'selectOption', 'clearCurrentSelection', 'reportIssue'],
      init: function (document) {
    // Live Countdown Timer
    epQuizPaused = false;
    epQuizQuestion = 1;
    let totalSeconds = 24 * 60 + 18;
    const timerElement = document.getElementById('assessment-timer');

    const countdownInterval = setInterval(() => {
      if (epQuizPaused) return;
      if (totalSeconds <= 0) {
        clearInterval(countdownInterval);
        timerElement.innerText = "00:00";
        alert("Шалгалтын цаг дууслаа!");
        return;
      }
      totalSeconds--;
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      timerElement.innerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);

    // Flag toggle state
    let isFlagged = false;
    window.toggleFlag = toggleFlag;
    function toggleFlag() {
      isFlagged = !isFlagged;
      const flagIcon = document.getElementById('flag-icon');
      const flagText = document.getElementById('flag-text');
      const gridBtn = document.getElementById('grid-btn-8');

      if (isFlagged) {
        flagIcon.textContent = 'bookmark';
        flagText.textContent = 'Тэмдэглэсэн байна';
        flagText.classList.add('text-primary');
        gridBtn.classList.add('bg-secondary-container', 'text-on-secondary-container');
      } else {
        flagIcon.textContent = 'flag';
        flagText.textContent = 'Асуултыг тэмдэглэх';
        flagText.classList.remove('text-primary');
        gridBtn.classList.remove('bg-secondary-container', 'text-on-secondary-container');
      }
    }

    // Radio Option micro-interaction
    window.selectOption = selectOption;
    function selectOption(radio) {
      document.querySelectorAll('#quiz-options label').forEach(lbl => {
        lbl.classList.remove('bg-surface-container-highest');
      });
      radio.closest('label').classList.add('bg-surface-container-highest');
    }

    window.clearCurrentSelection = clearCurrentSelection;
    function clearCurrentSelection() {
      const radios = document.getElementsByName('quiz_q8');
      radios.forEach(r => r.checked = false);
      document.querySelectorAll('#quiz-options label').forEach(lbl => {
        lbl.classList.remove('bg-surface-container-highest');
      });
    }

    window.reportIssue = reportIssue;
    function reportIssue() {
      alert("Таны илгээсэн санал #8 дугаартай асуулт дээр амжилттай бүртгэгдлээ. Хянагч багш нар шалгах болно.");
    }
  
      }
    },
    '19': {
      expose: [],
      init: function (document) {
// (no script on this page)
      }
    },
    '20': {
      expose: [],
      init: function (document) {
// (no script on this page)
      }
    },
    '21': {
      expose: [],
      init: function (document) {
    (function () {
      const filterBtns = document.querySelectorAll('.filter-btn');
      const searchInput = document.getElementById('search-input');
      const sortSelect = document.getElementById('sort-select');
      const grid = document.getElementById('projects-grid');
      const cards = Array.from(document.querySelectorAll('.project-card'));

      let currentCategory = 'all';
      let searchQuery = '';

      function applyFilters() {
        cards.forEach((card) => {
          const category = card.getAttribute('data-category');
          const title = card.querySelector('h3').textContent.toLowerCase();
          const desc = card.querySelector('p').textContent.toLowerCase();

          const matchesCat = currentCategory === 'all' || category === currentCategory;
          const matchesSearch = !searchQuery || title.includes(searchQuery) || desc.includes(searchQuery);

          if (matchesCat && matchesSearch) {
            card.classList.remove('hidden');
          } else {
            card.classList.add('hidden');
          }
        });
      }

      function applySorting() {
        const sortMode = sortSelect.value;
        const sortedCards = [...cards].sort((a, b) => {
          if (sortMode === 'upvotes') {
            return parseInt(b.getAttribute('data-upvotes'), 10) - parseInt(a.getAttribute('data-upvotes'), 10);
          } else if (sortMode === 'curator') {
            const aCurator = a.textContent.includes('Ментор') ? 1 : 0;
            const bCurator = b.textContent.includes('Ментор') ? 1 : 0;
            return bCurator - aCurator;
          } else {
            return new Date(b.getAttribute('data-date')) - new Date(a.getAttribute('data-date'));
          }
        });

        sortedCards.forEach((c) => grid.appendChild(c));
      }

      filterBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          filterBtns.forEach((b) => {
            b.classList.remove('active', 'bg-primary', 'text-on-primary', 'font-semibold');
            b.classList.add('text-on-surface-variant');
          });
          btn.classList.add('active', 'bg-primary', 'text-on-primary', 'font-semibold');
          btn.classList.remove('text-on-surface-variant');
          currentCategory = btn.getAttribute('data-filter');
          applyFilters();
        });
      });

      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          searchQuery = e.target.value.trim().toLowerCase();
          applyFilters();
        });
      }

      if (sortSelect) {
        sortSelect.addEventListener('change', () => {
          applySorting();
        });
      }

      // Upvote Micro-interaction
      document.querySelectorAll('.upvote-btn').forEach((button) => {
        button.addEventListener('click', function (e) {
          e.preventDefault();
          const isVoted = this.getAttribute('data-voted') === 'true';
          const counter = this.querySelector('.upvote-counter');
          let currentVal = parseInt(this.getAttribute('data-count'), 10);

          if (!isVoted) {
            currentVal += 1;
            this.setAttribute('data-voted', 'true');
            this.classList.remove('bg-surface-container', 'text-on-surface');
            this.classList.add('bg-primary', 'text-on-primary');
            this.querySelector('.material-symbols-outlined').classList.remove('text-primary');
            this.querySelector('.material-symbols-outlined').classList.add('text-on-primary');
          } else {
            currentVal -= 1;
            this.removeAttribute('data-voted');
            this.classList.add('bg-surface-container', 'text-on-surface');
            this.classList.remove('bg-primary', 'text-on-primary');
            this.querySelector('.material-symbols-outlined').classList.add('text-primary');
            this.querySelector('.material-symbols-outlined').classList.remove('text-on-primary');
          }
          this.setAttribute('data-count', currentVal);
          this.closest('.project-card').setAttribute('data-upvotes', currentVal);
          counter.textContent = currentVal;
        });
      });
    })();
  
      }
    },
    '22': {
      expose: ['switchTab', 'toggleCompleted'],
      init: function (document) {
    if (currentLessonContext) {
      var courseTitle = document.getElementById('classroom-course-title');
      var lessonTitle = document.getElementById('classroom-lesson-title');
      var contentTitle = document.getElementById('classroom-content-title');
      if (courseTitle) courseTitle.textContent = currentLessonContext.course;
      if (lessonTitle) lessonTitle.textContent = currentLessonContext.lesson;
      if (contentTitle) contentTitle.textContent = currentLessonContext.lesson;
      currentLessonContext = null;
    }

    window.switchTab = switchTab;
    function switchTab(tabId) {
      const tabs = ['notes', 'assignment', 'qa', 'privatenotes'];
      tabs.forEach(id => {
        const content = document.getElementById('tabContent-' + id);
        const btn = document.getElementById('tabBtn-' + id);
        if (!content || !btn) return;
        
        if (id === tabId) {
          content.classList.remove('hidden');
          btn.classList.add('text-primary', 'bg-surface-container-lowest', 'font-bold', 'shadow-sm');
          btn.classList.remove('text-on-surface-variant');
        } else {
          content.classList.add('hidden');
          btn.classList.remove('text-primary', 'bg-surface-container-lowest', 'font-bold', 'shadow-sm');
          btn.classList.add('text-on-surface-variant');
        }
      });
    }

    window.toggleCompleted = toggleCompleted;
    function toggleCompleted(btn) {
      const isCompleted = btn.getAttribute('data-completed') === 'true';
      if (!isCompleted) {
        btn.setAttribute('data-completed', 'true');
        btn.innerHTML = '<span class="material-symbols-outlined text-[20px]">verified</span><span>Амжилттай дууссан! ✔</span>';
        btn.classList.remove('bg-tertiary');
        btn.classList.add('bg-tertiary-container');
      } else {
        btn.setAttribute('data-completed', 'false');
        btn.innerHTML = '<span class="material-symbols-outlined text-[20px]">check_circle</span><span>Хичээл дуусгасан гэж тэмдэглэх</span>';
        btn.classList.remove('bg-tertiary-container');
        btn.classList.add('bg-tertiary');
      }
    }
  
      }
    },
    '23': {
      expose: [],
      init: function (document) {
    document.addEventListener('DOMContentLoaded', () => {
      // FAQ Accordion Behavior
      const accordionItems = document.querySelectorAll('.faq-item');
      
      accordionItems.forEach(item => {
        const toggleBtn = item.querySelector('.faq-toggle');
        const content = item.querySelector('.faq-content');
        const icon = item.querySelector('.faq-icon');
        
        toggleBtn.addEventListener('click', () => {
          const isOpen = !content.classList.contains('hidden');
          
          // Close all other accordions for clean single-view reading
          accordionItems.forEach(otherItem => {
            const otherContent = otherItem.querySelector('.faq-content');
            const otherIcon = otherItem.querySelector('.faq-icon');
            if (otherContent !== content) {
              otherContent.classList.add('hidden');
              otherIcon.textContent = 'expand_more';
              otherIcon.classList.remove('rotate-180');
            }
          });
          
          if (isOpen) {
            content.classList.add('hidden');
            icon.textContent = 'expand_more';
            icon.classList.remove('rotate-180');
          } else {
            content.classList.remove('hidden');
            icon.textContent = 'expand_less';
            icon.classList.add('rotate-180');
          }
        });
      });

      // Quick keyword injection into search bar
      const searchInput = document.getElementById('kb-search-input');
      const keywordButtons = document.querySelectorAll('button:not(.faq-toggle)');
      keywordButtons.forEach(btn => {
        if (btn.closest('.font-body-sm') && searchInput) {
          btn.addEventListener('click', () => {
            searchInput.value = btn.textContent.trim();
            searchInput.focus();
          });
        }
      });
    });
  
      }
    },
    '24': {
      expose: [],
      init: function (document) {
  (function initNotificationHub() {
    // Filter pill toggles
    const pills = document.querySelectorAll('.tab-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        const selected = pill.textContent.trim().toLowerCase();
        pills.forEach(p => {
          p.classList.remove('bg-primary', 'text-on-primary', 'font-semibold');
          p.classList.add('text-on-surface-variant');
        });
        pill.classList.remove('text-on-surface-variant');
        pill.classList.add('bg-primary', 'text-on-primary', 'font-semibold');

        const list = document.getElementById('notificationList');
        const chat = document.getElementById('chatStream');
        const form = document.getElementById('chatForm');
        if (list) list.classList.toggle('hidden', selected === 'зурвас');
        if (chat) chat.classList.toggle('hidden', selected !== 'зурвас');
        if (form) form.classList.toggle('hidden', selected !== 'зурвас');
        if (list && selected !== 'зурвас') {
          list.querySelectorAll(':scope > *').forEach(item => {
            const text = item.textContent.toLowerCase();
            const matches = selected === 'бүх мэдэгдэл' ||
              (selected === 'даалгавар' && /даалгавар|шалгалт|үнэлгээ/.test(text)) ||
              (selected === 'багш' && /багш|teacher|ментор/.test(text)) ||
              (selected === 'систем' && /систем|шинэ хөтөлбөр|зар/.test(text));
            item.classList.toggle('hidden', !matches);
          });
        }
      });
    });

    // Mark All Read interaction
    const markReadBtn = document.getElementById('markAllReadBtn');
    if (markReadBtn) {
      markReadBtn.addEventListener('click', () => {
        const indicators = document.querySelectorAll('#notificationList .bg-primary.w-1');
        indicators.forEach(el => el.classList.remove('bg-primary'));
        markReadBtn.innerHTML = '<span class="material-symbols-outlined text-[18px] text-primary">check</span><span>Бүгдийг уншсан</span>';
      });
    }

    // Interactive Chat Input
    const chatForm = document.getElementById('chatForm');
    const messageInput = document.getElementById('messageInput');
    const chatStream = document.getElementById('chatStream');

    if (chatStream) {
      chatStream.innerHTML = `
        <div class="m-auto flex max-w-md flex-col items-center gap-space-sm text-center" role="status">
          <span class="material-symbols-outlined text-5xl text-outline" aria-hidden="true">forum</span>
          <h2 class="font-headline-sm text-headline-sm text-on-surface">Одоогоор зурвас байхгүй байна</h2>
          <p class="font-body-sm text-body-sm text-on-surface-variant">Профайл олдсонгүй. Нэвтрэлтийн төлөв Unknown тул зурвасын түүх харагдахгүй байна.</p>
        </div>
      `;
    }

    if (chatForm && messageInput && chatStream) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        e.stopPropagation();
        notify('Нэвтрэлтийн төлөв Unknown тул зурвас илгээх боломжгүй. Эхлээд нэвтэрнэ үү.');
      });
    }
  })();
      }
    },
    '25': {
      expose: [],
      init: function (document) {
    (function initEduPulseAbout() {
      const modal = document.getElementById('mentorDialog');
      const openBtn = document.getElementById('mentorModalTrigger');
      const closeBtn = document.getElementById('mentorDialogClose');
      const cancelBtn = document.getElementById('mentorDialogCancel');
      const form = document.getElementById('mentorForm');

      function openModal() {
        if (!modal) return;
        modal.classList.remove('opacity-0', 'pointer-events-none');
        modal.classList.add('opacity-100', 'pointer-events-auto');
      }

      function closeModal() {
        if (!modal) return;
        modal.classList.add('opacity-0', 'pointer-events-none');
        modal.classList.remove('opacity-100', 'pointer-events-auto');
      }

      if (openBtn) openBtn.addEventListener('click', openModal);
      if (closeBtn) closeBtn.addEventListener('click', closeModal);
      if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
      if (form) {
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          event.stopPropagation();
          closeModal();
          notify('Демо маягт тул хүсэлт илгээгдээгүй, хадгалагдаагүй.');
        });
      }
    })();
  
      }
    },
    '27': {
      expose: [],
      init: function () {}
    },
    '28': {
      expose: [],
      init: function (document) {
        var form = document.getElementById('contact-inquiry-form');
        if (!form) return;
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          event.stopPropagation();
          var data = new FormData(form);
          var subject = 'EduPulse үнийн санал - ' + String(data.get('plan') || 'course');
          var body = [
            'Нэр: ' + String(data.get('name') || ''),
            'Имэйл: ' + String(data.get('email') || ''),
            'Сонголт: ' + String(data.get('plan') || ''),
            'Зурвас: ' + String(data.get('message') || '')
          ].join('\n');
          window.location.href = 'mailto:support@edupulse.mn?subject=' +
            encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
          notify('Имэйл програмд хүсэлтийн ноорог нээгдэх бөгөөд илгээхийг та баталгаажуулна.');
        });
      }
    },
    '29': {
      expose: [],
      init: function () {}
    }
  };

  /* ---------------------------------------------------------------------
     3. Mounting
     --------------------------------------------------------------------- */
  var app = document.getElementById('ep-app');
  var pagePicker = document.getElementById('ep-page-picker');
  var current = null;   // { id, root, sandbox }
  var currentLessonContext = null;
  var epDarkMode = window.localStorage.getItem('ep-theme') === 'dark';
  var CART_STORAGE_KEY = 'ep-cart-items';

  function readCart() {
    var stored = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!stored) return [];

    try {
      var items = JSON.parse(stored);
      if (!Array.isArray(items)) throw new Error('Stored cart is not an array.');
      return items.filter(function (item) {
        return item && typeof item.id === 'string' &&
          typeof item.title === 'string' && Number.isFinite(Number(item.price));
      });
    } catch (error) {
      console.error('Unable to read the saved cart.', error);
      notify('Сагсны мэдээллийг уншихад алдаа гарлаа.');
      return [];
    }
  }

  function writeCart(items) {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
      syncCartBadge();
      return true;
    } catch (error) {
      console.error('Unable to save the cart.', error);
      notify('Сагсыг хадгалах боломжгүй байна.');
      return false;
    }
  }

  function formatCartPrice(amount) {
    return new Intl.NumberFormat('mn-MN').format(amount) + '₮';
  }

  function updateCartCount(root, count) {
    if (!root) return;
    root.querySelectorAll('[data-cart-count]').forEach(function (badge) {
      badge.textContent = String(count);
    });
  }

  function cartItemFromButton(button) {
    var card = button.closest('.group');
    if (!card) return null;

    var title = card.querySelector('h3');
    var currentPrice = card.querySelector('.font-headline-sm.text-headline-sm.text-primary.font-bold');
    var originalPrice = card.querySelector('.line-through');
    var instructor = card.querySelector('.font-label-md.text-label-md.text-on-surface.font-semibold') ||
      card.querySelector('img.rounded-full + span');
    var image = card.querySelector('img');
    var price = currentPrice ? Number(currentPrice.textContent.replace(/[^\d]/g, '')) : 0;
    if (!title || !currentPrice || !price) return null;

    return {
      id: title.textContent.trim(),
      title: title.textContent.trim(),
      instructor: instructor ? instructor.textContent.trim() : '',
      price: price,
      originalPrice: originalPrice ? Number(originalPrice.textContent.replace(/[^\d]/g, '')) : price,
      image: image ? image.getAttribute('src') : ''
    };
  }

  function renderCartPage(root) {
    var container = root.querySelector('#cart-items-container');
    if (!container) return;

    var items = readCart();
    var count = root.querySelector('#cart-count-display');
    if (count) count.textContent = String(items.length);
    var headerCount = root.querySelector('#checkout-header-cart-count');
    if (headerCount) headerCount.textContent = String(items.length);
    updateCartCount(root, items.length);

    var total = 0;
    var originalTotal = 0;
    container.innerHTML = '';
    if (!items.length) {
      container.innerHTML = '<div class="rounded-lg bg-surface-container-high p-space-lg text-center"><p class="font-body-md text-body-md text-on-surface-variant">Таны сагс хоосон байна. Сургалт сонгож нэмнэ үү.</p><a class="mt-space-sm inline-flex items-center gap-1 font-label-md text-label-md text-primary" href="#p03">Сургалт сонгох <span class="material-symbols-outlined text-[18px]">arrow_forward</span></a></div>';
    }

    items.forEach(function (item) {
      var row = document.createElement('article');
      row.className = 'bg-surface-container-high rounded-lg p-space-md flex flex-col sm:flex-row gap-space-md';
      row.setAttribute('data-cart-item', item.id);

      var image = document.createElement('img');
      image.className = 'w-full sm:w-44 h-28 rounded-lg object-cover bg-surface-container-lowest';
      image.alt = item.title;
      if (item.image) image.src = item.image;

      var imageWrap = document.createElement('div');
      imageWrap.className = 'w-full sm:w-44 h-28 shrink-0';
      if (item.image) {
        imageWrap.appendChild(image);
      } else {
        imageWrap.className += ' flex items-center justify-center rounded-lg bg-surface-container-lowest text-primary';
        imageWrap.innerHTML = '<span class="material-symbols-outlined text-[40px]">' +
          (item.kind === 'plan' ? 'workspace_premium' : 'school') + '</span>';
      }

      var details = document.createElement('div');
      details.className = 'flex flex-col justify-between flex-1 min-w-0';
      var heading = document.createElement('div');
      heading.className = 'flex items-start justify-between gap-space-sm';
      var title = document.createElement('h3');
      title.className = 'font-title-md text-title-md text-primary leading-tight';
      title.textContent = item.title;
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'text-on-surface-variant hover:text-primary p-1 rounded transition-colors shrink-0';
      remove.setAttribute('aria-label', 'Хасах');
      remove.setAttribute('data-cart-remove', item.id);
      remove.innerHTML = '<span class="material-symbols-outlined text-[20px]">delete_outline</span>';
      heading.appendChild(title);
      heading.appendChild(remove);

      var instructor = document.createElement('p');
      instructor.className = 'pt-2 font-body-sm text-body-sm text-on-surface-variant';
      instructor.textContent = item.instructor;
      var price = document.createElement('p');
      price.className = 'pt-space-sm font-headline-sm text-headline-sm text-primary font-bold';
      price.textContent = formatCartPrice(Number(item.price));
      details.appendChild(heading);
      if (item.instructor) details.appendChild(instructor);
      details.appendChild(price);
      row.appendChild(imageWrap);
      row.appendChild(details);
      container.appendChild(row);

      total += Number(item.price);
      originalTotal += Number(item.originalPrice) || Number(item.price);
    });

    var extras = root.querySelector('[data-ep-cart-extras]');
    if (!extras) {
      extras = document.createElement('div');
      extras.setAttribute('data-ep-cart-extras', '');
      extras.className = 'flex flex-wrap items-center gap-space-md pt-space-sm';
      extras.innerHTML =
        '<a class="inline-flex items-center gap-1 font-label-md text-label-md text-primary" href="#p03">' +
        '<span class="material-symbols-outlined text-[18px]">arrow_back</span>Сургалт нэмэх</a>' +
        '<a class="inline-flex items-center gap-1 font-label-md text-label-md text-primary" href="#p13">' +
        'Бүх сургалтад хандах гишүүнчлэл үзэх<span class="material-symbols-outlined text-[18px]">arrow_forward</span></a>';
      container.parentNode.insertBefore(extras, container.nextSibling);
    }

    var values = {
      '#cart-original-total': formatCartPrice(originalTotal),
      '#cart-discount-total': originalTotal > total ? '-' + formatCartPrice(originalTotal - total) : formatCartPrice(0),
      '#cart-current-total': formatCartPrice(total),
      '#cart-coupon-discount': formatCartPrice(0),
      '#cart-payable-total': formatCartPrice(total)
    };
    Object.keys(values).forEach(function (selector) {
      var element = root.querySelector(selector);
      if (element) element.textContent = values[selector];
    });

    var checkout = root.querySelector('[data-cart-checkout]');
    if (checkout) {
      checkout.disabled = !items.length;
      checkout.classList.toggle('opacity-50', !items.length);
      checkout.classList.toggle('cursor-not-allowed', !items.length);
    }
  }

  function applyTheme(isDark, persist) {
    epDarkMode = isDark;
    document.body.classList.toggle('ep-dark-mode', isDark);
    if (current) current.root.classList.toggle('ep-dark-mode', isDark);

    var toggle = document.getElementById('ep-theme-toggle');
    if (toggle) {
      toggle.setAttribute('aria-pressed', String(isDark));
      toggle.setAttribute('aria-label', isDark ? 'Цагаан горим асаах' : 'Хар горим асаах');
      toggle.title = isDark ? 'Цагаан горим руу шилжих' : 'Хар горим руу шилжих';
      toggle.querySelector('.material-symbols-outlined').textContent = isDark ? 'light_mode' : 'dark_mode';
    }

    if (persist) window.localStorage.setItem('ep-theme', isDark ? 'dark' : 'light');
  }

  function templateFor(id) {
    return document.querySelector('template[data-page-id="' + id + '"]');
  }

  function unmount() {
    if (!current) return;
    var sb = current.sandbox;
    sb.listeners.forEach(function (l) { epRealRemove.call(l[0], l[1], l[2], l[3]); });
    sb.timers.forEach(function (t) { epRealClearTimeout(t); epRealClearInterval(t); });
    sb.exposed.forEach(function (name) { delete window[name]; });
    if (current.root.parentNode) current.root.parentNode.removeChild(current.root);
    epActive = null;
    current = null;
  }

  function mount(id) {
    var tpl = templateFor(id);
    if (!tpl) return;
    var fromId = current ? current.id : null;
    unmount();
    if (fromId && fromId !== id && INFO_PAGES.indexOf(fromId) === -1) referrerPageId = fromId;
    closeAccountMenu();

    var root = document.createElement('div');
    root.setAttribute('data-page', id);
    root.classList.toggle('ep-dark-mode', epDarkMode);

    var body = document.createElement('div');          // carries the page's original <body> classes
    body.className = tpl.getAttribute('data-body-class') || '';
    body.appendChild(tpl.content.cloneNode(true));
    root.appendChild(body);
    app.appendChild(root);

    root.querySelectorAll('footer h2, footer h3, footer h4, footer span').forEach(function (heading) {
      if (heading.textContent.trim() === 'Сургалтын хөтөлбөр' && heading.parentElement) {
        heading.parentElement.remove();
      }
    });

    var sandbox = { listeners: [], timers: [], exposed: [] };
    epActive = sandbox;
    current = { id: id, root: root, sandbox: sandbox };

    document.title = tpl.getAttribute('data-title') || document.title;
    window.scrollTo(0, 0);

    var page = PAGES[id];
    if (page) {
      try {
        page.init.call(root, epScopedDocument(root));
        (page.expose || []).forEach(function (name) { sandbox.exposed.push(name); });
      } catch (err) {
        console.error('[EduPulse] page ' + id + ' failed to start:', err);
      }
    }
    try {
      runMountHooks(id, root);
    } catch (err) {
      console.error('[EduPulse] page ' + id + ' flow hooks failed:', err);
    }
    updateNavigation(id);
  }

  /* ---------------------------------------------------------------------
     4. Navigation
     --------------------------------------------------------------------- */
  /* ---------------------------------------------------------------------
     4a. Site flow: how the pages connect, like a real website.

     Journeys covered (each page has at least one way in and one way out):
       Discover -> buy : 01 -> 03 -> 04 -> 10 -> 11 -> 14 / 22 / 07
       Membership      : 13 -> 10 -> 11 -> 14        (Enterprise -> 28)
       Billing         : 14 <-> 19 (payment methods), 14 -> 13, 14 -> 28
       Learning        : 07 -> 22 / 05 -> 18 -> 08 -> 12 -> 29
       Teaching        : 17 -> 15 -> 04 (preview), 20 <- 04
       Help / legal    : any page -> 23 -> 28, footer -> 26 / 27 (back to the
                         page you came from)
       Account menu    : avatar / header button -> 09, 07, 12, 14, 19, 17, 24, 23, 02
     --------------------------------------------------------------------- */
  var PAGE_NAMES = {
    '01': 'Нүүр',
    '02': 'Нэвтрэх, бүртгүүлэх',
    '03': 'Сургалтын каталог',
    '04': 'Сургалтын дэлгэрэнгүй',
    '05': 'Хичээлийн материал',
    '07': 'Миний сургалт',
    '08': 'Даалгавар, код шалгах',
    '09': 'Оюутны профайл',
    '10': 'Сагс',
    '11': 'Захиалгын амжилт',
    '12': 'Сургалтын аналитик',
    '13': 'Үнийн багц',
    '14': 'Төлбөр, нэхэмжлэх',
    '15': 'Сургалт үүсгэх',
    '16': 'Оюутны нийгэмлэг',
    '17': 'Багшийн самбар',
    '18': 'Сорил',
    '19': 'Хэрэглэгчийн тохиргоо',
    '20': 'Багшийн профайл',
    '21': 'Төслийн сан',
    '22': 'Хичээл үзэх',
    '23': 'Тусламж',
    '24': 'Мэдэгдэл',
    '25': 'Бидний тухай',
    '26': 'Үйлчилгээний нөхцөл',
    '27': 'Нууцлалын бодлого',
    '28': 'Холбоо барих',
    '29': 'Жишээ сертификат'
  };

  var referrerPageId = null;       // last "real" page before a legal/info page
  var pendingSettingsTab = '';     // tab to open when page 19 mounts
  var INFO_PAGES = ['26', '27', '28', '29'];

  /* "home Нүүр" -> "Нүүр", "Дэлгэрэнгүй arrow_forward" -> "Дэлгэрэнгүй" */
  function plainLabel(text) {
    var s = String(text || '').replace(/\s+/g, ' ').trim();
    s = s.replace(/^[a-z]+(?:_[a-z]+)*(?=[^\u0000-\u007f])/, '');
    s = s.replace(/^[a-z]+(?:_[a-z]+)*\s+(?=[^\u0000-\u007f])/, '');
    s = s.replace(/([^\u0000-\u007f])\s+[a-z]+(?:_[a-z]+)*$/, '$1');
    return s.trim();
  }

  /* Icon-only links ("open_in_new") are named by their aria-label / title */
  function routeLabel(target) {
    var text = (target.textContent || '').replace(/\s+/g, ' ').trim();
    var named = target.getAttribute('aria-label') || target.getAttribute('title') || '';
    if (named && (!text || /^[a-z_]+(?: [a-z_]+)*$/.test(text))) return named;
    return text;
  }

  function openSettingsTab(tabText) {
    return function () {
      pendingSettingsTab = tabText;
      return '19';
    };
  }

  var BRAND_RE = /^(?:[a-z]\s?|code|school)?edupulse$/i;

  /* [pages it applies to (null = every page), label pattern, destination] */
  var FLOW_RULES = [
    // every page
    [null, BRAND_RE, '01'],
    [null, /^(сагс|миний сагс|cart)$/i, '10'],
    [null, /^(түгээмэл асуултууд|тусламжийн төв)$/i, '23'],
    [null, /багшлах хүсэлт/i, '17'],
    [null, /байгууллагын сургалт|байгууллагаар авах|байгууллагаа/i, '13'],
    [null, /^бүртгэл цуцлах$/i, '14'],
    [null, /ажлын байрны зуучлал|ажилд зуучлах/i, '21'],
    [null, /интерактив лаборатори|код шалгах автомат машин/i, '08'],
    [null, /шуурхай чат/i, '24'],
    [null, /discord/i, '16'],
    [null, /дэлгэрэнгүй журам/i, '26'],
    [null, /^гарах$/i, '02'],
    [null, /^forum$/i, '16'],
    [null, /^terminal$/i, '08'],
    [null, /^dataset$/i, '12'],
    // dashboard sidebar: links to the page you are already on
    [['07'], /^(хяналтын самбар|миний сургалтууд)$/i, '07'],
    // landing
    [['01'], /үнэгүй хичээл үзэх/i, '22'],
    [['01'], /^хичээл сонгох$/i, '03'],
    [['01'], /бүх ангиллыг харах/i, '03'],
    // course detail
    [['04'], /^видео танилцуулга үзэх$/i, '22'],
    [['04'], /^(программчлал|сургалтууд)$/i, '03'],
    // learning
    [['05', '22'], /ментортой холбогдох/i, '20'],
    [['08'], /full-stack web/i, '04'],
    [['08'], /^модуль \d+$/i, '22'],
    [['08'], /^api docs$/i, '23'],
    // student profile
    [['09'], /^холбогдох$/i, '24'],
    [['09'], /баталгаажуулалтын лавлагаа|^verify/i, '29'],
    [['09'], /docs & demo/i, '21'],
    // purchase done -> invoices
    [['11'], /нэхэмжлэх|и-баримт/i, '14'],
    // analytics
    [['12'], /бүх шалгалтыг үзэх/i, '18'],
    // billing -> payment methods
    [['14'], /карт холбох/i, openSettingsTab('төлбөрийн хэрэгсэл')],
    // instructor side
    [['15'], /урьдчилан харах/i, '04'],
    [['17'], /үргэлжлүүлэн засварлах/i, '15'],
    [['17'], /статистик харах/i, '12'],
    [['17'], /бүх \d+ асуултыг нээх/i, '16'],
    [['17'], /^хариулах$/i, '24'],
    // community / showcase
    [['16'], /бүрэн дүрэм журам/i, '26'],
    [['16'], /онооны самбар/i, '21'],
    [['21'], /тавигдах шаардлага унших/i, '23'],
    [['21'], /төсөл илгээх/i, '08'],
    [['21'], /хуудас руу ор/i, '09'],
    // help center categories
    [['23'], /төлбөр, нэхэмжлэх/i, '14'],
    [['23'], /байгууллагын захиалга/i, '13'],
    [['23'], /хэрэглэгчийн эрх|нууц үг сэргээх/i, openSettingsTab('аюулгүй байдал')],
    [['23'], /кодын терминал|даалгавар илгээх/i, '08'],
    [['23'], /багш болох/i, '17'],
    [['23'], /сургалт эхлүүлэх/i, '22'],
    [['23'], /тикет үүсгэх/i, '28'],
    // notifications
    [['24'], /мэдэгдлийн тохиргоо/i, openSettingsTab('мэдэгдлийн тохиргоо')],
    [['24'], /сургалтын лавлагаа харах/i, '22']
  ];

  function flowRoute(target, label) {
    if (!current) return null;
    var plain = plainLabel(label);
    for (var i = 0; i < FLOW_RULES.length; i++) {
      var rule = FLOW_RULES[i];
      if (rule[0] && rule[0].indexOf(current.id) === -1) continue;
      if (rule[1].test(plain) || rule[1].test(label)) {
        var dest = typeof rule[2] === 'function' ? rule[2](target, plain) : rule[2];
        if (dest) return dest;
      }
    }
    return null;
  }

  /* ---- cart helpers -------------------------------------------------- */
  function syncCartBadge() {
    var count = readCart().length;
    document.querySelectorAll('[data-ep-cart-badge]').forEach(function (badge) {
      badge.textContent = String(count);
      badge.classList.toggle('is-empty', !count);
    });
  }

  function cartHas(id) {
    return readCart().some(function (item) { return item.id === id; });
  }

  /* The course shown on the detail page (04) -> a cart item */
  function cartItemFromDetail(root) {
    var title = root.querySelector('h1');
    var priceEl = Array.from(root.querySelectorAll('.text-display-hero-mobile')).find(function (el) {
      return /₮/.test(el.textContent);
    });
    var price = priceEl ? Number(priceEl.textContent.replace(/[^\d]/g, '')) : 0;
    if (!title || !price) return null;
    var oldEl = priceEl.parentElement ? priceEl.parentElement.querySelector('.line-through') : null;
    var heading = Array.from(root.querySelectorAll('h2')).find(function (h) {
      return /багшийн танилцуулга/i.test(h.textContent);
    });
    var teacher = heading && heading.parentElement ? heading.parentElement.querySelector('h3') : null;
    var image = root.querySelector('img.w-full.h-full.object-cover');
    var text = title.textContent.replace(/\s+/g, ' ').trim();
    return {
      id: text,
      title: text,
      instructor: teacher ? teacher.textContent.replace(/\s+/g, ' ').replace(/^verified\s*/i, '').trim() : '',
      price: price,
      originalPrice: oldEl ? (Number(oldEl.textContent.replace(/[^\d]/g, '')) || price) : price,
      image: image ? image.getAttribute('src') || '' : ''
    };
  }

  /* A membership plan chosen on the pricing page (13) -> a cart item */
  function cartItemFromPlan(root, plan) {
    var price = root.querySelector('#' + plan + 'Price');
    var period = root.querySelector('#' + plan + 'Period');
    var amount = price ? Number(price.textContent.replace(/[^\d]/g, '')) : 0;
    if (!amount) return null;
    var yearly = !!(period && /жил/i.test(period.textContent));
    var name = plan === 'ultra' ? 'Ultra' : 'Premium';
    return {
      id: 'plan:' + plan,
      kind: 'plan',
      title: name + ' багц (' + (yearly ? 'жилээр' : 'сараар') + ')',
      instructor: 'EduPulse гишүүнчлэл',
      price: amount,
      originalPrice: yearly ? amount / 0.8 : amount,
      image: ''
    };
  }

  /* Once something is in the cart the button becomes "go to cart" */
  function markAdded(button) {
    button.setAttribute('data-ep-added', 'true');
    button.setAttribute('aria-label', 'Сагс руу очих');
    button.setAttribute('title', 'Сагс руу очих');
    if (button.hasAttribute('data-cart-detail')) {
      button.innerHTML = '<span class="material-symbols-outlined text-[20px] text-primary">shopping_cart_checkout</span> Сагс руу очих';
    } else {
      var icon = button.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = 'shopping_cart_checkout';
    }
  }

  function syncAddedButtons(root) {
    root.querySelectorAll('[data-cart-add]').forEach(function (button) {
      var item = cartItemFromButton(button);
      if (item && cartHas(item.id)) markAdded(button);
    });
    var detail = root.querySelector('[data-cart-detail="add"]');
    if (detail) {
      var item = cartItemFromDetail(root);
      if (item && cartHas(item.id)) markAdded(detail);
    }
  }

  function isCourseCard(card) {
    return !!(card && card.querySelector('h3') && card.querySelector('[data-cart-add]'));
  }

  /* ---- account menu (avatar / header button) ------------------------- */
  var ACCOUNT_LINKS = [
    ['person', 'Нийтийн профайл', '09'],
    ['school', 'Миний сургалт', '07'],
    ['insights', 'Суралцах аналитик', '12'],
    ['receipt_long', 'Төлбөр, нэхэмжлэх', '14'],
    ['settings', 'Тохиргоо', '19'],
    ['cast_for_education', 'Багшийн самбар', '17'],
    ['notifications', 'Мэдэгдэл, чат', '24'],
    ['help', 'Тусламж', '23'],
    ['logout', 'Системээс гарах', '02']
  ];
  var accountMenu = null;

  function buildAccountMenu() {
    accountMenu = document.createElement('div');
    accountMenu.id = 'ep-account-menu';
    accountMenu.setAttribute('role', 'menu');
    accountMenu.hidden = true;
    accountMenu.innerHTML = ACCOUNT_LINKS.map(function (row) {
      return '<a role="menuitem" href="#p' + row[2] + '" data-ep-menu-go="' + row[2] + '">' +
        '<span class="material-symbols-outlined" aria-hidden="true">' + row[0] + '</span>' + row[1] + '</a>';
    }).join('');
    document.body.appendChild(accountMenu);
    accountMenu.addEventListener('click', function (e) {
      var link = e.target.closest('[data-ep-menu-go]');
      if (!link) return;
      e.preventDefault();
      closeAccountMenu();
      go(link.getAttribute('data-ep-menu-go'), true);
    });
  }

  function closeAccountMenu() {
    if (!accountMenu || accountMenu.hidden) return;
    accountMenu.hidden = true;
    var trigger = document.getElementById('ep-account-btn');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
  }

  function toggleAccountMenu() {
    if (!accountMenu) return;
    accountMenu.hidden = !accountMenu.hidden;
    var trigger = document.getElementById('ep-account-btn');
    if (trigger) trigger.setAttribute('aria-expanded', String(!accountMenu.hidden));
  }

  /* ---- things that run right after a page is mounted ------------------ */
  function runMountHooks(id, root) {
    syncCartBadge();
    syncAddedButtons(root);

    // course cards open the course page, so they look clickable
    if (id === '01' || id === '03') {
      root.querySelectorAll('.group').forEach(function (card) {
        if (isCourseCard(card)) card.style.cursor = 'pointer';
      });
    }

    if (id === '04') {
      var heading = Array.from(root.querySelectorAll('h2')).find(function (h) {
        return /багшийн танилцуулга/i.test(h.textContent);
      });
      if (heading && heading.parentElement && !heading.parentElement.querySelector('[data-ep-teacher-link]')) {
        var more = document.createElement('a');
        more.href = '#p20';
        more.setAttribute('data-ep-teacher-link', '');
        more.className = 'mt-space-sm inline-flex items-center gap-1 font-label-md text-label-md text-primary';
        more.innerHTML = 'Багшийн профайл үзэх <span class="material-symbols-outlined text-[18px]">arrow_forward</span>';
        heading.parentElement.appendChild(more);
      }
    }

    if (id === '13') {
      root.querySelectorAll('.faq-content').forEach(function (answer) {
        if (/и-баримт/i.test(answer.textContent) && !answer.querySelector('[data-ep-invoice-link]')) {
          var link = document.createElement('a');
          link.href = '#p14';
          link.setAttribute('data-ep-invoice-link', '');
          link.className = 'mt-space-sm inline-flex items-center gap-1 font-label-md text-label-md text-primary';
          link.innerHTML = 'Нэхэмжлэх, и-баримтуудаа харах <span class="material-symbols-outlined text-[18px]">arrow_forward</span>';
          answer.appendChild(link);
        }
      });
    }

    if (id === '19' && pendingSettingsTab) {
      var wanted = pendingSettingsTab.toLowerCase();
      pendingSettingsTab = '';
      var tab = Array.from(root.querySelectorAll('button')).find(function (button) {
        return buttonLabel(button).toLowerCase().indexOf(wanted) !== -1;
      });
      if (tab) tab.click();
    }

    if (id === '28') {
      var intro = root.querySelector('.terms-content');
      if (intro && !intro.querySelector('[data-ep-faq-hint]')) {
        var hint = document.createElement('p');
        hint.setAttribute('data-ep-faq-hint', '');
        hint.className = 'font-body-md text-body-md text-on-surface-variant mt-space-md';
        hint.innerHTML = 'Түргэн хариулт хэрэгтэй бол эхлээд <a class="text-primary font-semibold" href="#p23">Түгээмэл асуултууд</a>-ыг үзээрэй.';
        var firstTitle = intro.querySelector('h2');
        if (firstTitle && firstTitle.nextElementSibling) firstTitle.nextElementSibling.insertAdjacentElement('afterend', hint);
        else intro.appendChild(hint);
      }
    }

    // legal / contact pages: "back" goes to the page the visitor came from
    var back = root.querySelector('.terms-back-link');
    if (back && referrerPageId && referrerPageId !== id && PAGE_NAMES[referrerPageId]) {
      back.setAttribute('href', '#p' + referrerPageId);
      back.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">arrow_back</span> ' +
        PAGE_NAMES[referrerPageId] + ' руу буцах';
    }
  }

  /* Lesson rows on the lesson pages ("4.4 Custom Hooks ...") switch the lesson in place */
  function lessonFromLabel(label) {
    var match = /(\d+\.\d+)\s+([^\d].*?)(?:\s+\d{1,2}:\d{2}.*)?$/.exec(label.replace(/\s+/g, ' '));
    if (!match) return null;
    var title = match[2]
      .replace(/\s+[a-z]+(?:_[a-z]+)+$/, '')          // trailing icon name, e.g. "chevron_right"
      .replace(/\s+\d+\s*(мин|min).*$/i, '')
      .replace(/\s*[✔✓]\s*$/, '')
      .trim();
    return { number: match[1], title: title };
  }

  function openLesson(lesson) {
    var heading = current && current.root.querySelector('h1');
    if (heading) heading.textContent = lesson.title;
    window.scrollTo(0, 0);
    notify('Хичээл ' + lesson.number + ' нээгдлээ.');
  }

  var PATHS = {
    nuur: '01',
    surgaltuud: '03',
    'minii-surgalt': '07',
    'hicheel-uzeh': '22',
    sambar: '12',
    tosluud: '21',
    une: '13',
    'khamt-olon': '25',
    nuutslal: '27',
    'uilchilgeenii-nohtsol': '26',
    daalgavar: '08',
    'amjilt-sertefikat': '29',
    tohirgoo: '19',
    nuhtsul: '26'
  };

  function idFromHash() {
    var match = /^#p(\d{2})$/.exec(location.hash);
    return match && templateFor(match[1]) ? match[1] : null;
  }

  function go(id, push) {
    if (!templateFor(id)) return;
    if (current && current.id === id && push) window.scrollTo(0, 0);
    if (!current || current.id !== id) mount(id);
    var hash = '#p' + id;
    if (location.hash !== hash) {
      if (push) history.pushState(null, '', hash);
      else history.replaceState(null, '', hash);
    }
  }

  function updateNavigation(id) {
    document.querySelectorAll('[data-ep-nav]').forEach(function (link) {
      if (link.getAttribute('data-ep-nav') === id) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
    if (pagePicker) pagePicker.value = id;
  }

  function initPagePicker() {
    if (!pagePicker) return;

    var pageNames = PAGE_NAMES;

    Array.from(document.querySelectorAll('template[data-page-id]'))
      .sort(function (a, b) {
        return Number(a.getAttribute('data-page-id')) - Number(b.getAttribute('data-page-id'));
      })
      .forEach(function (template) {
        var id = template.getAttribute('data-page-id');
        var option = document.createElement('option');
        option.value = id;
        option.textContent = id + ' · ' + (pageNames[id] || template.getAttribute('data-label') || 'Хуудас');
        pagePicker.appendChild(option);
      });

    pagePicker.addEventListener('change', function () {
      if (this.value) go(this.value, true);
    });
  }

  initPagePicker();

  function contextualRoute(target, label) {
    if (!current) return null;
    var flowDestination = flowRoute(target, label);
    if (flowDestination) return flowDestination;
    label = plainLabel(label);
    if (/^нүүр$/i.test(label)) return '01';
    if (/мэдэгдэл|notifications/i.test(label)) return '24';
    if (/^(нэвтрэх|бүртгүүлэх|анкет оруулах|системээс гарах)$/i.test(label)) return '02';
    if (/тусламж|help center|шууд чат эхлүүлэх/i.test(label)) return '23';
    if (/багц.*(авах|сонгох)|гишүүн болох|membership/i.test(label)) return '13';
    if (/^(нийгэмлэг|хэлэлцүүлэг|community)$/i.test(label)) return '16';
    if (/^(үнэ|үнийн багц|үнийн санал|pricing)$/i.test(label)) return '13';
    if (/^(төлбөр|нэхэмжлэх|и-баримт)$/i.test(label)) return '14';
    if (/^(профайл|тохиргоо|хувийн мэдээлэл)$/i.test(label)) return '19';
    if (/нууцлал/i.test(label)) return '27';
    if (/холбоо барих/i.test(label)) return '28';
    if (/үйлчилгээний нөхцөл|^нөхцөл$/i.test(label)) return '26';
    if (/^(даалгавар|даалгаврууд|assignment)$/i.test(label)) return '08';
    if (/сертификат/i.test(label)) return '29';
    if (/^(хичээлүүд|хичээл үзэх|хичээл эхлүүлэх)$/i.test(label)) return '22';
    if (/^(хөтөлбөрүүд|сургалтууд|сургалтын каталог)$/i.test(label)) return '03';
    if (/^(түншүүд|бидний тухай|хамт олон)$/i.test(label)) return '25';
    if (/менторшип/i.test(label)) return '20';
    if (current.id === '07' && /бүгдийг харах/i.test(label)) return '03';
    if (current.id === '01' && /(ангилал|сургалт|хичээл хайх)/i.test(label)) return '03';
    if (/(сургалтууд руу буцах|сургалтын каталог)/i.test(label)) return '03';
    if (current.id === '03' && (
      target.closest('article, [data-course-card], .course-card') ||
      /(дэлгэрэнгүй|course details)/i.test(label)
    )) return '04';
    if (current.id === '04' && /(сагс|элсэх|бүртгүүлэх|худалдан авах|enroll|checkout)/i.test(label)) return '10';
    if (current.id === '10' && /(төлөх|захиалах|баталгаажуулах|pay|place order)/i.test(label)) return '11';
    if (current.id === '11' && /(classroom player|суралцаж эхлэх)/i.test(label)) return '22';
    if (current.id === '11' && /(dashboard|суралцах самбар)/i.test(label)) return '07';
    if (current.id === '11' && /(хичээл|сургалтаа эхлүүлэх|үргэлжлүүлэх|эхлэх)/i.test(label)) return '07';
    if (current.id === '07' && /(хичээл|үргэлжлүүлэн суралцах|сургалтаа үргэлжлүүлэх|continue learning)/i.test(label)) return '22';
    if ((current.id === '05' || current.id === '22') && /(сорил|quiz)/i.test(label)) return '18';
    if ((current.id === '05' || current.id === '22') && /(даалгавар|илгээх|assignment)/i.test(label)) return '08';
    if (current.id === '18' && /(суралцах самбар|dashboard)/i.test(label)) return '07';
    if (current.id === '17' && /(шинэ сургалт нэмэх|сургалт үүсгэх)/i.test(label)) return '15';
    if (current.id === '20' && /(дэлгэрэнгүй|сургалт үзэх)/i.test(label)) return '04';
    return null;
  }

  var toastTimer = null;
  function notify(message) {
    var toast = document.getElementById('ep-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-visible');
    if (toastTimer) epRealClearTimeout(toastTimer);
    toastTimer = epRealSetTimeout.call(window, function () {
      toast.classList.remove('is-visible');
    }, 2600);
  }

  function buttonLabel(button) {
    return (button.getAttribute('aria-label') || button.getAttribute('title') || button.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function setPressed(button, pressed) {
    button.setAttribute('aria-pressed', String(pressed));
    button.classList.toggle('bg-primary', pressed);
    button.classList.toggle('text-on-primary', pressed);
    button.classList.toggle('is-active', pressed);
  }

  function getCatalogCards(root) {
    var detailButtons = Array.from(root.querySelectorAll('button')).filter(function (button) {
      return /дэлгэрэнгүй/i.test(buttonLabel(button));
    });
    return Array.from(new Set(detailButtons.map(function (button) {
      return button.closest('.group') || button.closest('article') || button.parentElement;
    }).filter(Boolean)));
  }

  function setCatalogPriceFilter(root, value) {
    root.querySelectorAll('#filter-sidebar [data-price-filter]').forEach(function (button) {
      var selected = button.getAttribute('data-price-filter') === value;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('bg-surface-container-high', selected);
      button.classList.toggle('text-primary', selected);
      button.classList.toggle('bg-surface-container-low', !selected);
      button.classList.toggle('text-on-surface-variant', !selected);
    });
  }

  function applyCatalogFilters(query) {
    if (!current || current.id !== '03') return;
    var root = current.root;
    var categories = Array.from(root.querySelectorAll('input[name="course-category"]:checked')).map(function (input) { return input.value; });
    var levels = Array.from(root.querySelectorAll('input[name="course-level"]:checked')).map(function (input) { return input.value; });
    var formats = Array.from(root.querySelectorAll('input[name="course-format"]:checked')).map(function (input) { return input.value; });
    var duration = root.querySelector('input[name="duration"]:checked');
    var minimumRating = root.querySelector('input[name="rating_filter"]:checked');
    var priceFilter = root.querySelector('#filter-sidebar [data-price-filter][aria-pressed="true"]');
    var visibleCount = 0;
    var normalizedQuery = (query || '').trim().toLowerCase();

    getCatalogCards(root).forEach(function (card) {
      if (!card.hasAttribute('data-ep-original-hidden')) {
        card.setAttribute('data-ep-original-hidden', String(card.classList.contains('hidden')));
      }
      var categoriesOnCard = (card.dataset.courseCategories || '').split(/\s+/);
      var levelsOnCard = (card.dataset.courseLevels || '').split(/\s+/);
      var formatsOnCard = (card.dataset.courseFormats || '').split(/\s+/);
      var hours = Number(card.dataset.courseDuration);
      var rating = Number(card.dataset.courseRating);
      var cardPrice = card.dataset.coursePrice;
      var matchesDuration = !duration ||
        (duration.value === 'short' && hours <= 2) ||
        (duration.value === 'standard' && hours >= 3 && hours <= 6) ||
        (duration.value === 'long' && hours >= 10);
      var matchesPrice = !priceFilter || priceFilter.dataset.priceFilter === 'all' ||
        (priceFilter.dataset.priceFilter === 'free' && cardPrice === 'free') ||
        (priceFilter.dataset.priceFilter === 'discounted' && cardPrice === 'discounted') ||
        (priceFilter.dataset.priceFilter === 'paid' && cardPrice !== 'free');
      var matches = (!categories.length || categories.some(function (value) { return categoriesOnCard.includes(value); })) &&
        (!levels.length || levels.some(function (value) { return levelsOnCard.includes(value); })) &&
        matchesDuration &&
        (!formats.length || formats.some(function (value) { return formatsOnCard.includes(value); })) &&
        (!minimumRating || rating >= Number(minimumRating.value)) &&
        matchesPrice &&
        (!normalizedQuery || card.textContent.toLowerCase().includes(normalizedQuery));
      var originallyHidden = card.getAttribute('data-ep-original-hidden') === 'true';
      card.classList.toggle('hidden', originallyHidden || !matches);
      if (!originallyHidden && matches) visibleCount++;
    });

    var visibleRange = root.querySelector('#catalog-visible-range');
    if (visibleRange) visibleRange.textContent = visibleCount ? '1 - ' + visibleCount : '0';
  }

  function filterVisibleItems(query) {
    if (!current) return;
    if (current.id === '03') {
      applyCatalogFilters(query);
      return;
    }
    var root = current.root;
    var items = [];
    if (current.id === '03') {
      var detailButtons = Array.from(root.querySelectorAll('button')).filter(function (button) {
        return /дэлгэрэнгүй/i.test(buttonLabel(button));
      });
      items = detailButtons.map(function (button) {
        return button.closest('.group') || button.closest('article') || button.parentElement;
      });
    } else if (current.id === '21') {
      items = Array.from(root.querySelectorAll('.project-card'));
    } else if (current.id === '23') {
      items = Array.from(root.querySelectorAll('.faq-item'));
    } else if (current.id === '24') {
      items = Array.from(root.querySelectorAll('#notificationList > *'));
    }

    items = Array.from(new Set(items.filter(Boolean)));
    if (!items.length) return;
    items.forEach(function (item) {
      if (!item.hasAttribute('data-ep-original-hidden')) {
        item.setAttribute('data-ep-original-hidden', String(item.classList.contains('hidden')));
      }
      var originallyHidden = item.getAttribute('data-ep-original-hidden') === 'true';
      item.classList.toggle('hidden', originallyHidden || (!!query && !item.textContent.toLowerCase().includes(query)));
    });
  }

  function applyCheckedFilters() {
    if (!current) return;
    var root = current.root;
    if (current.id === '03') {
      var searchInput = root.querySelector('input[placeholder*="Хичээлийн нэр"]');
      applyCatalogFilters(searchInput ? searchInput.value : '');
      notify('Сонгосон шүүлтүүрээр үр дүнг шинэчиллээ.');
      return;
    }
    var items = [];
    var choices = [];
    var checked = Array.from(root.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked'));
    checked.forEach(function (input) {
      var label = input.closest('label');
      if (!label && input.id) label = root.querySelector('label[for="' + CSS.escape(input.id) + '"]');
      if (label) choices.push(label.textContent.replace(/\b\d+\b/g, '').trim().toLowerCase());
    });

    if (current.id === '03') {
      var detailButtons = Array.from(root.querySelectorAll('button')).filter(function (button) {
        return /дэлгэрэнгүй/i.test(buttonLabel(button));
      });
      items = detailButtons.map(function (button) {
        return button.closest('.group') || button.closest('article');
      });
    }

    items = Array.from(new Set(items.filter(Boolean)));
    if (!items.length) return;
    items.forEach(function (item) {
      if (!item.hasAttribute('data-ep-original-hidden')) {
        item.setAttribute('data-ep-original-hidden', String(item.classList.contains('hidden')));
      }
      var originalHidden = item.getAttribute('data-ep-original-hidden') === 'true';
      var itemText = item.textContent.toLowerCase();
      var matches = !choices.length || choices.some(function (choice) { return !choice || itemText.includes(choice); });
      item.classList.toggle('hidden', originalHidden || !matches);
    });
    notify('Сонгосон шүүлтүүрээр үр дүнг шинэчиллээ.');
  }

  function handleSearchInput(input) {
    var query = input.value.trim().toLowerCase();
    filterVisibleItems(query);
  }

  function fallbackButton(button) {
    if (!current || button.disabled || button.getAttribute('type') === 'submit') return;
    var label = buttonLabel(button);
    var lower = label.toLowerCase();
    var pageId = current.id;

    if (/мэдэгдэл|notifications/i.test(label)) {
      go('24', true);
      return;
    }

    if (/^(хайх|search)$/i.test(label)) {
      var search = button.parentElement && button.parentElement.querySelector('input[type="search"], input[type="text"]');
      if (search) {
        handleSearchInput(search);
        search.focus();
        notify(search.value ? 'Хайлтын үр дүн шинэчлэгдлээ.' : 'Хайх үгээ оруулна уу.');
      }
      return;
    }

    if (pageId === '03') {
      if (/^бүгд$/i.test(label)) {
        selectedCourseCategory = '';
        selectedCourseQuery = '';
        current.root.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(function (input) { input.checked = false; });
        current.root.querySelectorAll('input[type="text"], input[type="search"]').forEach(function (input) { input.value = ''; });
        setCatalogPriceFilter(current.root, 'all');
        filterVisibleItems('');
        notify('Бүх сургалтыг харуулж байна.');
        return;
      }
      if (/^(үнэгүй|хөнгөлөлттэй|төлбөртэй)$/i.test(label)) {
        setCatalogPriceFilter(current.root, button.getAttribute('data-price-filter'));
        var catalogSearch = current.root.querySelector('input[placeholder*="Хичээлийн нэр"]');
        applyCatalogFilters(catalogSearch ? catalogSearch.value : '');
        notify(label + ' сургалтуудыг шүүж байна.');
        return;
      }
      if (/дэлгэрэнгүй/i.test(label)) {
        go('04', true);
        return;
      }
      if (/бүгдийг арилгах|хайлтыг арилгах|цэвэрлэх|refresh/i.test(label)) {
        selectedCourseCategory = '';
        selectedCourseQuery = '';
        current.root.querySelectorAll('input[type="checkbox"], input[type="radio"]').forEach(function (input) { input.checked = false; });
        current.root.querySelectorAll('input[type="text"], input[type="search"]').forEach(function (input) { input.value = ''; });
        setCatalogPriceFilter(current.root, 'all');
        filterVisibleItems('');
        notify('Сургалтын хайлт, шүүлтүүрийг цэвэрлэлээ.');
        return;
      }
      if (/шүүлтүүр/i.test(label)) {
        var sidebar = current.root.querySelector('#filter-sidebar');
        if (sidebar) {
          sidebar.classList.toggle('hidden');
          notify(sidebar.classList.contains('hidden') ? 'Шүүлтүүрийг хаалаа.' : 'Шүүлтүүр нээгдлээ.');
          return;
        }
      }
    }

    if (pageId === '10') {
      if (/сагсыг цэвэрлэх/i.test(label)) {
        var cart = current.root.querySelector('#cart-items-container');
        if (cart) cart.innerHTML = '<p class="ep-empty-state">Таны сагс хоосон байна. Сургалт сонгож нэмнэ үү.</p>';
        notify('Сагсыг цэвэрлэлээ.');
        return;
      }
      if (/delete|устгах/i.test(lower)) {
        var cart = current.root.querySelector('#cart-items-container');
        var item = button.closest('[id^="item-course-"]');
        if (!item && cart) {
          item = button;
          while (item.parentElement && item.parentElement !== cart) item = item.parentElement;
        }
        if (item && item !== cart && item.parentElement) item.remove();
        notify('Сургалтыг сагснаас хаслаа.');
        return;
      }
      if (/ашиглах|купон/i.test(lower)) {
        var coupon = current.root.querySelector('input[placeholder*="Купон"], input[name*="coupon" i]');
        if (!coupon || !coupon.value.trim()) {
          notify('Купон кодоо эхлээд оруулна уу.');
        } else {
          button.disabled = true;
          button.setAttribute('aria-pressed', 'true');
          notify('Купон кодыг шалгаж, хөнгөлөлтийг тооцлоо.');
        }
        return;
      }
    }

    if (pageId === '18') {
      if (/түр завсарлах|pause/i.test(lower)) {
        var paused = button.getAttribute('aria-pressed') !== 'true';
        epQuizPaused = paused;
        setPressed(button, paused);
        button.setAttribute('aria-label', paused ? 'Шалгалтыг үргэлжлүүлэх' : 'Шалгалтыг түр завсарлах');
        notify(paused ? 'Шалгалтын цаг түр зогслоо.' : 'Шалгалт үргэлжилж байна.');
        return;
      }
      if (/шалгалт дуусгах/i.test(lower)) {
        if (window.confirm('Та шалгалтаа дуусгахдаа итгэлтэй байна уу?')) go('07', true);
        return;
      }
      if (/сонголтыг цэвэрлэх/i.test(lower)) {
        current.root.querySelectorAll('input[type="radio"]:checked').forEach(function (input) { input.checked = false; });
        current.root.querySelectorAll('#quiz-options label').forEach(function (option) { option.classList.remove('bg-surface-container-highest'); });
        notify('Сонгосон хариултыг арилгалаа.');
        return;
      }
      if (/^(1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24)$/i.test(label) ||
          /өмнөх асуулт|дараагийн асуулт/i.test(lower)) {
        var questionButtons = Array.from(current.root.querySelectorAll('button')).filter(function (candidate) {
          return /^(1|2|3|4|5|6|7|8|9|10|11|12|13|14|15|16|17|18|19|20|21|22|23|24)$/.test(buttonLabel(candidate));
        });
        if (/өмнөх асуулт/i.test(lower)) epQuizQuestion = Math.max(1, epQuizQuestion - 1);
        else if (/дараагийн асуулт/i.test(lower)) epQuizQuestion = Math.min(questionButtons.length || 24, epQuizQuestion + 1);
        else epQuizQuestion = Number(label);
        questionButtons.forEach(function (candidate) {
          var active = Number(buttonLabel(candidate)) === epQuizQuestion;
          candidate.classList.toggle('is-active', active);
          if (active) candidate.setAttribute('aria-current', 'step');
          else candidate.removeAttribute('aria-current');
        });
        notify('Асуулт ' + epQuizQuestion + ' сонгогдлоо.');
        return;
      }
    }

    if (pageId === '19') {
      if (/системээс гарах|logout/i.test(lower)) {
        go('02', true);
        return;
      }
      if (/хадгалах|өөрчлөлтийг хадгалах/i.test(lower)) {
        notify('Тохиргооны өөрчлөлтийг хадгаллаа.');
        return;
      }
      if (/хувийн мэдээлэл|аюулгүй байдал|төлбөрийн хэрэгсэл|мэдэгдлийн тохиргоо|суралцах зорилго|холбогдсон хаягууд/i.test(lower)) {
        current.root.querySelectorAll('[data-settings-panel]').forEach(function (panel) { panel.classList.add('hidden'); });
        var section = button.getAttribute('data-settings-section') || lower;
        var panel = current.root.querySelector('[data-settings-panel="' + section + '"]');
        if (panel) panel.classList.remove('hidden');
        current.root.querySelectorAll('button').forEach(function (tab) { tab.classList.toggle('is-active', tab === button); });
        notify(label + ' хэсгийг нээлээ.');
        return;
      }
      if (/хар горим|цагаан/i.test(lower)) {
        var darkMode = /хар горим/i.test(lower);
        applyTheme(darkMode, true);
        notify(darkMode ? 'Хар горимыг идэвхжүүллээ.' : 'Цагаан горимыг идэвхжүүллээ.');
        return;
      }
    }

    if (pageId === '09' && button.getAttribute('data-ep-auth-required') === 'profile-save') {
      notify('Нэвтрэлтийн төлөв Unknown тул профайл хадгалах боломжгүй. Эхлээд нэвтэрч профайл үүсгэнэ үү.');
      return;
    }

    if (pageId === '20' && /захиалах|цаг захиалах|18:00|19:00|20:00|21:00/i.test(lower)) {
      button.setAttribute('aria-pressed', 'true');
      button.classList.add('is-active');
      notify('Уулзалтын цаг сонгогдлоо. Захиалгаа баталгаажуулна уу.');
      return;
    }

    if (pageId === '07' && /даалгаврын хуваарь/i.test(lower)) {
      go('12', true);
      return;
    }

    if (pageId === '17' && /тайлан татах/i.test(lower)) {
      notify('Багшийн тайланг татаж эхэллээ.');
      return;
    }

    if (/bookmark|favorite|хүслийн жагсаалт|хадгалах/i.test(lower)) {
      var pressed = button.getAttribute('aria-pressed') !== 'true';
      setPressed(button, pressed);
      notify(pressed ? 'Хадгалсан жагсаалтад нэмлээ.' : 'Хадгалсан жагсаалтаас хаслаа.');
      return;
    }

    if (/upload|зураг солих/i.test(lower) || (pageId === '15' && /^солих$/i.test(label))) {
      var fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = pageId === '19' ? 'image/*' : '*/*';
      fileInput.hidden = true;
      fileInput.addEventListener('change', function () {
        var file = fileInput.files && fileInput.files[0];
        if (!file) return;
        var image = button.closest('section, article, .group')?.querySelector('img') ||
          (pageId === '19' && current.root.querySelector('img[alt*="Profile"], img[alt*="профайл"]'));
        if (image && file.type.indexOf('image/') === 0) {
          if (image.dataset.epObjectUrl) URL.revokeObjectURL(image.dataset.epObjectUrl);
          image.dataset.epObjectUrl = URL.createObjectURL(file);
          image.src = image.dataset.epObjectUrl;
        }
        notify(file.name + ' файлыг сонголоо.');
        fileInput.remove();
      });
      current.root.appendChild(fileInput);
      fileInput.click();
      return;
    }

    if (/edit|засах/i.test(lower)) {
      var editable = button.closest('article, li, .group') || button.parentElement;
      if (editable) {
        editable.contentEditable = editable.contentEditable === 'true' ? 'false' : 'true';
        editable.focus();
        notify(editable.contentEditable === 'true' ? 'Талбарыг засах горим нээгдлээ.' : 'Засварыг дуусгалаа.');
      }
      return;
    }

    if (/delete|устгах/i.test(lower)) {
      if (pageId === '19') {
        var profileImage = button.closest('section, article, .group')?.querySelector('img') ||
          current.root.querySelector('img[alt*="Profile"], img[alt*="профайл"]');
        if (profileImage) {
          profileImage.removeAttribute('src');
          notify('Профайл зургийг арилгалаа.');
          return;
        }
      }
      var removable = button.closest('[data-ep-removable], article, li, .group');
      if (!removable) {
        removable = button.parentElement && button.parentElement.parentElement;
      }
      if (removable && removable !== current.root && removable.contains(button)) {
        removable.remove();
        notify('Сонгосон зүйлийг устгалаа.');
      } else {
        notify('Устгах зүйл олдсонгүй.');
      }
      return;
    }

    if (/share|хуваалцах/i.test(lower)) {
      var linkToShare = location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(linkToShare).then(function () {
          notify('Хуваалцах холбоосыг хууллаа.');
        }).catch(function () {
          notify('Холбоос: ' + linkToShare);
        });
      } else {
        notify('Холбоос: ' + linkToShare);
      }
      return;
    }

    if (/play_arrow|play_circle|pause|тоглуулах/i.test(lower)) {
      var playing = button.getAttribute('aria-pressed') !== 'true';
      setPressed(button, playing);
      notify(playing ? 'Хичээлийг тоглуулж байна.' : 'Хичээлийг түр зогсоолоо.');
      return;
    }

    if (/copy|хуулах/i.test(lower)) {
      notify('Хуулах зүйл бэлэн боллоо.');
      return;
    }

    if (/download|татах|pdf|csv/i.test(lower)) {
      notify('Татаж авах хүсэлтийг боловсрууллаа.');
      return;
    }

    if (/^(бүгд|шинэ|шилдэг|хариулаагүй|үнэгүй|хөнгөлөлттэй|төлбөртэй)$/i.test(label)) {
      var group = button.parentElement;
      if (group) {
        group.querySelectorAll('button').forEach(function (tab) {
          setPressed(tab, tab === button);
        });
      }
      notify(label + ' сонголтыг харуулж байна.');
      return;
    }

    if (/^(өмнөх|дараах|дараагийн|өмнөх асуулт|дараагийн асуулт|chevron_left|chevron_right|1|2|3|12)$/i.test(label)) {
      var active = button.parentElement && button.parentElement.querySelector('.is-active, [aria-current="page"]');
      button.parentElement && button.parentElement.querySelectorAll('button').forEach(function (tab) {
        tab.classList.remove('is-active');
        tab.removeAttribute('aria-current');
      });
      button.classList.add('is-active');
      button.setAttribute('aria-current', 'page');
      notify(active ? 'Хуудас шинэчлэгдлээ.' : 'Сонголт шинэчлэгдлээ.');
      return;
    }

    if (/expand|unfold|дэлгэх|нээх|chevron/i.test(lower)) {
      var content = button.nextElementSibling;
      if (content) content.classList.toggle('hidden');
      var expanded = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(expanded));
      notify(expanded ? 'Дэлгэрэнгүй мэдээллийг нээлээ.' : 'Мэдээллийг хураалаа.');
      return;
    }

    var destination = contextualRoute(button, label);
    if (destination) {
      go(destination, true);
      return;
    }
    notify(label ? label + ' үйлдлийг хийлээ.' : 'Үйлдэл амжилттай.');
  }

  /* ---------------------------------------------------------------------
     5. Boot
     --------------------------------------------------------------------- */
  function boot() {
    applyTheme(epDarkMode, false);
    buildAccountMenu();
    syncCartBadge();
    var accountButton = document.getElementById('ep-account-btn');
    if (accountButton) {
      accountButton.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleAccountMenu();
      });
    }
    document.addEventListener('click', function (e) {
      if (accountMenu && !accountMenu.hidden &&
          !e.target.closest('#ep-account-menu, #ep-account-btn, header img[alt="Profile"]')) {
        closeAccountMenu();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeAccountMenu();
    });
    window.addEventListener('storage', syncCartBadge);
    document.getElementById('ep-theme-toggle').addEventListener('click', function () {
      applyTheme(!epDarkMode, true);
    });

    app.addEventListener('click', function (e) {
      var planLink = e.target.closest ? e.target.closest('[data-contact-plan]') : null;
      if (planLink) {
        e.preventDefault();
        e.stopImmediatePropagation();
        var planName = planLink.getAttribute('data-contact-plan');
        if (planName === 'premium' || planName === 'ultra') {
          var planItem = cartItemFromPlan(current.root, planName);
          if (!planItem) {
            notify('Багцын үнийг уншиж чадсангүй.');
            return;
          }
          var cartWithPlan = readCart().filter(function (saved) { return saved.id.indexOf('plan:') !== 0; });
          cartWithPlan.push(planItem);
          if (!writeCart(cartWithPlan)) return;
          notify(planItem.title + ' сагсанд нэмэгдлээ.');
          go('10', true);
          return;
        }
        go('28', true);
        var planSelect = current && current.root.querySelector('#contact-plan');
        if (planSelect) planSelect.value = planName;
        return;
      }

      var detailButton = e.target.closest ? e.target.closest('[data-cart-detail]') : null;
      if (detailButton) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (detailButton.getAttribute('data-ep-added') === 'true') {
          go('10', true);
          return;
        }
        var detailItem = cartItemFromDetail(current.root);
        if (!detailItem) {
          notify('Сургалтын мэдээллийг уншиж чадсангүй.');
          return;
        }
        var detailCart = readCart();
        var alreadyThere = detailCart.some(function (saved) { return saved.id === detailItem.id; });
        if (!alreadyThere) {
          detailCart.push(detailItem);
          if (!writeCart(detailCart)) return;
        }
        if (detailButton.getAttribute('data-cart-detail') === 'now') {
          go('10', true);
        } else {
          markAdded(detailButton);
          updateCartCount(current.root, readCart().length);
          notify(alreadyThere ? 'Энэ сургалт сагсанд аль хэдийн байна.' : 'Сургалтыг сагсанд нэмлээ.');
        }
        return;
      }

      var featureButton = e.target.closest ? e.target.closest('[data-feature-route]') : null;
      if (featureButton) {
        e.preventDefault();
        e.stopImmediatePropagation();
        go(featureButton.getAttribute('data-feature-route'), true);
        return;
      }

      var previewButton = e.target.closest ? e.target.closest('[data-lesson-preview]') : null;
      if (previewButton) {
        e.preventDefault();
        e.stopImmediatePropagation();
        var previewRow = previewButton.closest('.flex.items-center.justify-between');
        var previewCourse = current.root.querySelector('h1');
        var previewLesson = previewRow && previewRow.querySelector('.font-body-sm');
        currentLessonContext = {
          course: previewCourse ? previewCourse.textContent.trim() : 'Сургалт',
          lesson: previewLesson ? previewLesson.textContent.trim() : 'Хичээлийн урьдчилан үзэх'
        };
        notify('Энэ хичээлийн урьдчилан үзэх бичлэг хараахан ороогүй байна.');
        go('22', true);
        return;
      }

      var addButton = e.target.closest ? e.target.closest('[data-cart-add]') : null;
      if (addButton) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (addButton.getAttribute('data-ep-added') === 'true') {
          go('10', true);
          return;
        }
        var item = cartItemFromButton(addButton);
        if (!item) {
          notify('Сургалтын мэдээллийг уншиж чадсангүй.');
          return;
        }
        var items = readCart();
        if (items.some(function (savedItem) { return savedItem.id === item.id; })) {
          notify('Энэ сургалт сагсанд аль хэдийн байна.');
          return;
        }
        items.push(item);
        if (writeCart(items)) {
          updateCartCount(current && current.root, items.length);
          markAdded(addButton);
          notify('Сургалтыг сагсанд нэмлээ.');
        }
        return;
      }

      var removeButton = e.target.closest ? e.target.closest('[data-cart-remove]') : null;
      if (removeButton) {
        e.preventDefault();
        e.stopImmediatePropagation();
        var itemId = removeButton.getAttribute('data-cart-remove');
        var remainingItems = readCart().filter(function (item) { return item.id !== itemId; });
        if (writeCart(remainingItems)) {
          renderCartPage(current.root);
          notify('Сургалтыг сагснаас хаслаа.');
        }
        return;
      }

      var clearButton = e.target.closest ? e.target.closest('[data-cart-clear]') : null;
      if (clearButton) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (writeCart([])) {
          renderCartPage(current.root);
          notify('Сагсыг цэвэрлэлээ.');
        }
        return;
      }

      var checkoutButton = e.target.closest ? e.target.closest('[data-cart-checkout]') : null;
      if (checkoutButton && !readCart().length) {
        e.preventDefault();
        e.stopImmediatePropagation();
        notify('Төлбөр төлөхөөс өмнө сургалт сагсандаа нэмнэ үү.');
        return;
      }
      if (checkoutButton) {
        e.preventDefault();
        e.stopImmediatePropagation();
        if (!writeCart([])) return;
        notify('Демо төлбөр амжилттай баталгаажлаа.');
        go('11', true);
        return;
      }
    }, true);

    app.addEventListener('click', function (e) {
      var avatar = e.target.closest ? e.target.closest('header img[alt="Profile"]') : null;
      if (avatar) {
        e.preventDefault();
        toggleAccountMenu();
        return;
      }

      if (current && (current.id === '01' || current.id === '03') &&
          !e.target.closest('button, a, input, select, textarea, label')) {
        var courseCard = e.target.closest('.group');
        if (isCourseCard(courseCard)) {
          go('04', true);
          return;
        }
      }

      var target = e.target.closest ? e.target.closest('a, button') : null;
      if (!target) return;

      if (current && (current.id === '05' || current.id === '22') && !target.closest('footer')) {
        var lessonText = (target.textContent || '').trim();
        var lesson = null;
        if (target.tagName === 'A') {
          lesson = lessonFromLabel(lessonText);
        } else if (/^дараагийн хичээл$/i.test(plainLabel(lessonText))) {
          var nextLink = Array.from(current.root.querySelectorAll('a')).find(function (link) {
            return /^дараагийн сэдэв/i.test(plainLabel(link.textContent));
          });
          lesson = nextLink ? lessonFromLabel(nextLink.textContent) : null;
        }
        if (lesson) {
          e.preventDefault();
          openLesson(lesson);
          return;
        }
      }

      var termsLink = target.closest('a[data-terms-nav]');
      if (termsLink && current && (current.id === '26' || current.id === '27')) {
        e.preventDefault();
        current.root.querySelectorAll('[data-terms-nav]').forEach(function (link) {
          link.classList.toggle('is-active', link === termsLink);
          if (link === termsLink) link.setAttribute('aria-current', 'location');
          else link.removeAttribute('aria-current');
        });
        var termsSection = current.root.querySelector(termsLink.getAttribute('href'));
        if (termsSection) termsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      if (target.hasAttribute('data-cart-menu')) {
        e.preventDefault();
        go('10', true);
        return;
      }

      if (current && current.id === '07' && /үргэлжлүүлэн үзэх|үргэлжлүүлэх|хичээл эхлүүлэх/i.test(buttonLabel(target))) {
        e.preventDefault();
        var courseCard = target.closest('.bg-surface-container-lowest');
        var courseTitle = courseCard && courseCard.querySelector('h4');
        var nextLesson = courseCard && courseCard.querySelector('strong');
        currentLessonContext = {
          course: courseTitle ? courseTitle.textContent.trim() : 'Миний сургалт',
          lesson: nextLesson ? nextLesson.textContent.trim() : 'Хичээлийн агуулга'
        };
        notify('Энэ хичээлийн бичлэг хараахан ороогүй байна.');
        go(/хичээл эхлүүлэх/i.test(buttonLabel(target)) ? '05' : '22', true);
        return;
      }

      var path = target.getAttribute('data-path');
      if (path && PATHS[path]) {
        e.preventDefault();
        go(PATHS[path], true);
        return;
      }

      var href = target.getAttribute('href');
      var pageLink = href && /^#p(\d{2})$/.exec(href);
      if (pageLink && templateFor(pageLink[1])) {
        e.preventDefault();
        go(pageLink[1], true);
        return;
      }

      var destination = contextualRoute(target, routeLabel(target));
      if (destination) {
        e.preventDefault();
        go(destination, true);
      } else if (target.tagName === 'A' && href === '#') {
        e.preventDefault();
        notify((routeLabel(target) || 'Холбоос') + ' хэсгийг нээхэд бэлэн.');
      } else if (target.tagName === 'BUTTON' &&
                 target.getAttribute('data-ep-bound') !== 'true' &&
                 !target.hasAttribute('onclick')) {
        if (target.type === 'submit' && target.form) {
          if (target.hasAttribute('type') || /илгээх|submit|төлөх|order/i.test(buttonLabel(target))) return;
          e.preventDefault();
        }
        fallbackButton(target);
      }
    });
    app.addEventListener('input', function (e) {
      if (e.target.matches('input[type="search"], input[id*="search" i], input[placeholder*="хайх" i], input[placeholder="Search"]')) {
        handleSearchInput(e.target);
      }
    });
    app.addEventListener('change', function (e) {
      if (e.target.matches('select')) {
        if (current && current.id === '03') {
          var cards = Array.from(current.root.querySelectorAll('button')).filter(function (button) {
            return /дэлгэрэнгүй/i.test(buttonLabel(button));
          }).map(function (button) {
            return button.closest('.group') || button.closest('article');
          }).filter(Boolean);
          cards = Array.from(new Set(cards));
          var parent = cards[0] && cards[0].parentElement;
          if (parent && cards.every(function (card) { return card.parentElement === parent; })) {
            var mode = e.target.options[e.target.selectedIndex].textContent.toLowerCase();
            cards.sort(function (a, b) {
              if (/эрэлт|үнэлгээ|popular|rating/i.test(mode)) {
                var ratingA = Number((a.textContent.match(/4\.\d+/) || ['0'])[0]);
                var ratingB = Number((b.textContent.match(/4\.\d+/) || ['0'])[0]);
                return ratingB - ratingA;
              }
              return a.textContent.localeCompare(b.textContent, 'mn');
            }).forEach(function (card) { parent.appendChild(card); });
          }
          notify('Сургалтуудыг сонгосон дарааллаар эрэмбэллээ.');
        } else {
          notify('Сонголтыг шинэчиллээ.');
        }
      } else if (e.target.matches('input[type="checkbox"], input[type="radio"]')) {
        applyCheckedFilters();
      }
    });
    app.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.matches('input[type="search"], input[id*="search" i], input[placeholder*="хайх" i], input[placeholder="Search"]')) {
        e.preventDefault();
        if (current && current.id === '01') {
          selectedCourseQuery = e.target.value.trim();
          go('03', true);
        }
        else handleSearchInput(e.target);
      }
    });
    app.addEventListener('submit', function (e) {
      e.preventDefault();
      if (current && current.id === '02') {
        return;
      } else if (current && current.id === '10') {
        go('11', true);
      } else {
        notify('Маягтыг амжилттай илгээлээ.');
      }
    });

    window.addEventListener('hashchange', route);
    window.addEventListener('popstate', route);

    route();
    if (!current) go('01', false);
  }

  function route() {
    var id = idFromHash();
    if (id) go(id, false);
  }

  boot();
})();
