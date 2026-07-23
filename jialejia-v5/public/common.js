/* ============================================
   佳乐家 · 公共工具库 V5.0
   ============================================ */

const API_BASE = '/api/v1';
const STORAGE_PREFIX = 'jlj_';

// ===== 工具函数 =====
const Utils = {
  // 存储
  get(key) { return localStorage.getItem(STORAGE_PREFIX + key); },
  set(key, val) { localStorage.setItem(STORAGE_PREFIX + key, val); },
  remove(key) { localStorage.removeItem(STORAGE_PREFIX + key); },
  getJSON(key) { try { return JSON.parse(this.get(key)); } catch { return null; } },
  setJSON(key, val) { this.set(key, JSON.stringify(val)); },

  // 格式化
  formatTime(t) {
    if (!t) return '';
    const d = new Date(t);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },
  formatDate(t) {
    if (!t) return '';
    const d = new Date(t);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  },
  formatMoney(n) { return '¥' + (parseFloat(n) || 0).toFixed(2); },
  getWeekDay(t) {
    const days = ['周日','周一','周二','周三','周四','周五','周六'];
    const d = new Date(t);
    const diff = Math.round((d - new Date()) / 86400000);
    if (diff === 0) return '今天';
    if (diff === 1) return '明天';
    if (diff === 2) return '后天';
    return days[d.getDay()];
  },
  getDaysAfter(n) {
    const d = new Date(); d.setDate(d.getDate() + n);
    return this.formatDate(d);
  },
  getStatusText(s) {
    const map = { pending:'待接单', assigned:'已接单', processing:'进行中', completed:'已完成', cancelled:'已取消', timeout:'超期完结', dispute:'争议中' };
    return map[s] || s;
  },
  getStatusClass(s) { return 'tag-' + s; },
  maskPhone(p) { return p ? p.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : ''; },

  // 校验
  isValidPhone(p) { return /^1\d{10}$/.test(p); },
  isValidName(n) { return n && n.length >= 2 && n.length <= 20; },

  // 提示
  toast(msg, icon = 'none') {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  },
  success(msg) { this.toast(msg); },
  error(msg) { this.toast(msg); },

  // 弹窗
  modal(title, content, onConfirm, onCancel, confirmText = '确定', cancelText = '取消') {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-content">
        <div class="modal-title">${title}</div>
        <div style="text-align:center;font-size:14px;color:#666;margin-bottom:16px;">${content}</div>
        <div class="modal-actions">
          ${onCancel ? `<button class="btn btn-outline" id="modalCancel">${cancelText}</button>` : ''}
          <button class="btn btn-primary" id="modalConfirm">${confirmText}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#modalConfirm')?.addEventListener('click', () => { overlay.remove(); onConfirm?.(); });
    overlay.querySelector('#modalCancel')?.addEventListener('click', () => { overlay.remove(); onCancel?.(); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); onCancel?.(); } });
  },
  confirm(title, content, onConfirm) { this.modal(title, content, onConfirm, null, '确定', '取消'); },
  alert(title, content) { this.modal(title, content, null, null, '知道了'); },

  // 获取当前时间列表
  getTimeSlots() {
    const slots = [];
    const now = new Date();
    for (let h = 8; h <= 18; h++) {
      const t1 = `${String(h).padStart(2,'0')}:00`;
      const t2 = `${String(h).padStart(2,'0')}:30`;
      slots.push(t1);
      if (h < 18) slots.push(t2);
    }
    return slots;
  },

  // 路由跳转
  go(url) { window.location.href = url; },
  goBack() { window.history.back(); },

  // 获取URL参数
  getQuery(key) {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
  }
};

// ===== API 封装 =====
const API = {
  token: Utils.get('token'),

  async request(url, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    try {
      const res = await fetch(API_BASE + url, { ...options, headers });
      const data = await res.json();
      if (data.code === 401) {
        Utils.remove('token');
        Utils.remove('userInfo');
        const current = window.location.pathname;
        if (!current.includes('/admin/')) {
          window.location.href = '/user/orders.html';
        }
        return data;
      }
      if (data.code !== 200 && data.code !== 201) {
        Utils.error(data.message);
      }
      return data;
    } catch (err) {
      Utils.error('网络异常');
      return { code: 500, message: '网络异常', data: null };
    }
  },

  get(url, params) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request(url + qs, { method: 'GET' });
  },
  post(url, data) { return this.request(url, { method: 'POST', body: JSON.stringify(data) }); },
  put(url, data) { return this.request(url, { method: 'PUT', body: JSON.stringify(data) }); },
  del(url) { return this.request(url, { method: 'DELETE' }); },

  // ===== 用户端 =====
  sendCode(phone) { return this.post('/user/verification-code', { phone }); },
  login(phone, code) { return this.post('/user/login', { phone, code }); },
  getUserProfile() { return this.get('/user/profile'); },
  createOrder(data) { return this.post('/orders', data); },
  getOrders(params) { return this.get('/orders', params); },
  getOrderDetail(no) { return this.get('/orders/' + no); },
  cancelOrder(no) { return this.post('/orders/' + no + '/cancel'); },
  evaluateOrder(no, data) { return this.post('/orders/' + no + '/evaluate', data); },
  getCategories() { return this.get('/services/categories'); },
  getServiceItems(cid) { return this.get('/services/items', cid ? { category_id: cid } : undefined); },
  getAnnouncements(page = 1) { return this.get('/announcements', { page }); },
  getAnnouncementDetail(id) { return this.get('/announcements/' + id); },

  // ===== 师傅端 =====
  techLogin(phone, password) { return this.post('/technician/login', { phone, password }); },
  techGetProfile() { return this.get('/technician/profile'); },
  techGetOrders(params) { return this.get('/technician/orders', params); },
  techAcceptOrder(no) { return this.post('/technician/orders/accept', { order_no: no }); },
  techCompleteOrder(data) { return this.post('/technician/orders/complete', data); },
  techCancelOrder(data) { return this.post('/technician/orders/cancel', data); },
  techTransferOrder(data) { return this.post('/technician/orders/transfer', data); },
  techCreateSelfOrder(data) { return this.post('/technician/orders/self', data); },
  techGetStatistics() { return this.get('/technician/statistics'); },
  techGetBalance() { return this.get('/technician/balance'); },
  techToggleBusy(busy) { return this.put('/technician/busy', { busy }); },
  techGetGallery() { return this.get('/technician/gallery'); },
  techGetDisputes() { return this.get('/technician/disputes'); },
  techCreateDispute(data) { return this.post('/technician/disputes', data); },
  techReportOnsite(data) { return this.post('/technician/orders/onsite', data); },
  techRequestAddition(data) { return this.post('/technician/orders/addition', data); },
  techGetOnsiteLogs(no) { return this.get('/technician/orders/' + no + '/onsite'); },

  // ===== 商家端 =====
  merchLogin(phone, password) { return this.post('/merchant/login', { phone, password }); },
  merchCreateOrder(data) { return this.post('/merchant/orders', data); },
  merchGetOrders() { return this.get('/merchant/orders'); },
  merchGetStatistics() { return this.get('/merchant/statistics'); },
  merchGetIncome() { return this.get('/merchant/income'); },
  merchWithdraw(amount) { return this.post('/merchant/withdraw', { amount }); },
  merchGetWithdraws() { return this.get('/merchant/withdraws'); },

  // ===== 后台管理 =====
  adminLogin(username, password) { return this.post('/admin/login', { username, password }); },
  adminGetDashboard() { return this.get('/admin/dashboard'); },
  adminGetOrders(params) { return this.get('/admin/orders', params); },
  adminForceTransfer(id, data) { return this.put('/admin/orders/' + id, data); },
  adminGetTrash() { return this.get('/admin/orders/trash'); },
  adminRestoreOrder(data) { return this.post('/admin/orders/trash/restore', data); },
  adminDeleteOrder(data) { return this.del('/admin/orders/trash', { body: JSON.stringify(data) }); },
  adminGetTechnicians(params) { return this.get('/admin/technicians', params); },
  adminAddTechnician(data) { return this.post('/admin/technicians', data); },
  adminUpdateTechnician(id, data) { return this.put('/admin/technicians/' + id, data); },
  adminGetTechnicianDetail(id) { return this.get('/admin/technicians/' + id); },
  adminGetMerchants() { return this.get('/admin/merchants'); },
  adminAddMerchant(data) { return this.post('/admin/merchants', data); },
  adminUpdateMerchant(id, data) { return this.put('/admin/merchants/' + id, data); },
  adminApproveWithdraw(id, status) { return this.post('/admin/merchants/withdraw/' + id, { status }); },
  adminGetServices() { return this.get('/admin/services'); },
  adminAddService(data) { return this.post('/admin/services', data); },
  adminUpdateService(id, data) { return this.put('/admin/services/' + id, data); },
  adminGetAnnouncements() { return this.get('/admin/announcements'); },
  adminCreateAnnouncement(data) { return this.post('/admin/announcements', data); },
  adminUpdateAnnouncement(id, data) { return this.put('/admin/announcements/' + id, data); },
  adminGetSettings() { return this.get('/admin/system/settings'); },
  adminUpdateSettings(data) { return this.put('/admin/system/settings', data); },
  adminGetLogs(params) { return this.get('/admin/system/logs', params); },
  adminGetRealtime() { return this.get('/admin/dashboard/realtime'); },
  adminReviewDispute(id, data) { return this.post('/admin/disputes/' + id + '/review', data); },
  adminGetDisputes() { return this.get('/admin/disputes'); },
};