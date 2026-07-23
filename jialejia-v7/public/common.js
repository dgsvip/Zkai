// ===== 佳乐家 V7.0 公共工具库 =====
const API_BASE = '/api/v1';
const STORAGE_PREFIX = 'jlj_';

// ===== 工具函数 =====
const Utils = {
  get(key) { try { return JSON.parse(localStorage.getItem(STORAGE_PREFIX + key)); } catch { return null; } },
  set(key, val) { localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(val)); },
  remove(key) { localStorage.removeItem(STORAGE_PREFIX + key); },
  clear() {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
  },

  toast(msg, duration = 2000) {
    const old = document.querySelector('.toast');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), duration);
  },

  success(msg) { this.toast(msg); },
  error(msg) { this.toast(msg); },
  loading(show = true) {
    const old = document.querySelector('.loading-overlay');
    if (old) old.remove();
    if (!show) return;
    const el = document.createElement('div');
    el.className = 'loading-overlay';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(255,255,255,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;';
    el.innerHTML = '<div class="loading-spinner"></div>';
    document.body.appendChild(el);
  },

  formatTime(t) {
    if (!t) return '';
    const d = new Date(t);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  formatDate(t) {
    if (!t) return '';
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  getDaysAfter(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return this.formatDate(d);
  },

  getWeekDay(date) {
    const days = ['周日','周一','周二','周三','周四','周五','周六'];
    return days[date.getDay()];
  },

  go(url) { window.location.href = url; },

  goBack() { window.history.back(); },

  getToken() { return this.get('token'); },

  isLoggedIn() { return !!this.getToken(); },

  logout() {
    this.remove('token');
    this.remove('userInfo');
    this.go('/');
  },

  statusText(status) {
    const map = {
      pending: '待接单', bidding: '抢单中', accepted: '进行中',
      in_progress: '进行中', completed: '已完成', cancelled: '已取消',
      overdue_closed: '超期完结', disputed: '争议中', transferring: '转派中',
      deleted: '已删除'
    };
    return map[status] || status;
  },

  statusClass(status) {
    const map = {
      pending: 'tag-pending', bidding: 'tag-bidding', accepted: 'tag-accepted',
      in_progress: 'tag-in_progress', completed: 'tag-completed',
      cancelled: 'tag-cancelled', overdue_closed: 'tag-overdue',
      disputed: 'tag-disputed'
    };
    return map[status] || '';
  },

  formatPrice(p) { return '¥' + (Number(p) || 0).toFixed(2); },

  sanitize(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  },

  validatePhone(phone) { return /^1\d{10}$/.test(phone); },

  validateName(name) { return name && name.length >= 2 && name.length <= 20; },

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
      if (data.code === 401 && !url.includes('/login')) {
        Utils.remove('token');
        Utils.remove('userInfo');
        const current = window.location.pathname;
        if (current.includes('/user/')) window.location.href = '/user/orders.html';
        else if (current.includes('/technician/')) window.location.href = '/technician/index.html';
        else if (current.includes('/admin/')) window.location.href = '/admin/login.html';
        return data;
      }
      return data;
    } catch (err) {
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
  updateUserProfile(data) { return this.put('/user/profile', data); },
  getAddresses() { return this.get('/user/profile'); },
  addAddress(data) { return this.post('/user/addresses', data); },
  updateAddress(id, data) { return this.put('/user/addresses/' + id, data); },
  deleteAddress(id) { return this.del('/user/addresses/' + id); },
  getCategories() { return this.get('/services/categories'); },
  getServiceItems(cid) { return this.get('/services/items', cid ? { category_id: cid } : undefined); },
  createOrder(data) { return this.post('/orders', data); },
  getOrders(params) { return this.get('/orders', params); },
  getOrderDetail(no) { return this.get('/orders/' + no); },
  cancelOrder(no, data) { return this.post('/orders/' + no + '/cancel', data || {}); },
  evaluateOrder(no, data) { return this.post('/orders/' + no + '/evaluate', data); },
  getOrderQueryCode(phone) { return this.post('/orders/query-code', { phone }); },
  getAnnouncements(page) { return this.get('/announcements', { page }); },
  getAnnouncementDetail(id) { return this.get('/announcements/' + id); },

  // ===== 师傅端 =====
  techLogin(phone, password) { return this.post('/technician/login', { phone, password }); },
  techGetProfile() { return this.get('/technician/profile'); },
  techUpdateProfile(data) { return this.put('/technician/profile', data); },
  techGetOrders(tab) { return this.get('/technician/orders', { tab }); },
  techGetActiveOrders() { return this.get('/technician/active-orders'); },
  techAcceptOrder(no) { return this.post('/technician/orders/accept', { order_no: no }); },
  techCompleteOrder(data) { return this.post('/technician/orders/complete', data); },
  techCancelOrder(data) { return this.post('/technician/orders/cancel', data); },
  techTransferOrder(data) { return this.post('/technician/orders/transfer', data); },
  techOnsiteStatus(data) { return this.post('/technician/orders/onsite', data); },
  techAdditionRequest(data) { return this.post('/technician/orders/addition', data); },
  techConfirmAddition(orderNo, confirm) { return this.post('/orders/' + orderNo + '/addition/confirm', { confirm }); },
  techGetStatistics() { return this.get('/technician/statistics'); },
  techGetBalance() { return this.get('/technician/balance'); },
  techGetGallery() { return this.get('/technician/gallery'); },
  techGetDisputes() { return this.get('/technician/disputes'); },
  techCreateDispute(data) { return this.post('/technician/disputes', data); },
  techGetHistory(params) { return this.get('/technician/history', params); },

  // ===== 商家端 =====
  merLogin(phone, password) { return this.post('/merchant/login', { phone, password }); },
  merGetStatistics() { return this.get('/merchant/statistics'); },
  merGetOrders() { return this.get('/merchant/orders'); },
  merCreateOrder(data) { return this.post('/merchant/orders', data); },
  merGetIncome() { return this.get('/merchant/income'); },
  merWithdraw(amount) { return this.post('/merchant/withdraw', { amount }); },
  merGetWithdraws() { return this.get('/merchant/withdraws'); },

  // ===== 后台管理 =====
  adminLogin(username, password) { return this.post('/admin/login', { username, password }); },
  adminGetDashboard() { return this.get('/admin/dashboard'); },
  adminGetOrders(params) { return this.get('/admin/orders', params); },
  adminUpdateOrder(id, data) { return this.put('/admin/orders/' + id, data); },
  adminRestoreOrder(id) { return this.post('/admin/orders/restore/' + id); },
  adminGetTechnicians(params) { return this.get('/admin/technicians', params); },
  adminCreateTechnician(data) { return this.post('/admin/technicians', data); },
  adminUpdateTechnician(id, data) { return this.put('/admin/technicians/' + id, data); },
  adminGetTechnicianDetail(id) { return this.get('/admin/technicians/' + id); },
  adminGetMerchants() { return this.get('/admin/merchants'); },
  adminCreateMerchant(data) { return this.post('/admin/merchants', data); },
  adminUpdateMerchant(id, data) { return this.put('/admin/merchants/' + id, data); },
  adminWithdrawMerchant(id) { return this.post('/admin/merchants/withdraw/' + id); },
  adminGetServices() { return this.get('/admin/services'); },
  adminCreateService(data) { return this.post('/admin/services', data); },
  adminUpdateService(id, data) { return this.put('/admin/services/' + id, data); },
  adminCreateCategory(data) { return this.post('/admin/categories', data); },
  adminUpdateCategory(id, data) { return this.put('/admin/categories/' + id, data); },
  adminDeleteCategory(id) { return this.del('/admin/categories/' + id); },
  adminGetAnnouncements() { return this.get('/admin/announcements'); },
  adminCreateAnnouncement(data) { return this.post('/admin/announcements', data); },
  adminUpdateAnnouncement(id, data) { return this.put('/admin/announcements/' + id, data); },
  adminGetRealtime() { return this.get('/admin/dashboard/realtime'); },
  adminGetSettings() { return this.get('/admin/system/settings'); },
  adminUpdateSettings(data) { return this.put('/admin/system/settings', data); },
  adminGetLogs(params) { return this.get('/admin/system/logs', params); },
  adminGetDisputes() { return this.get('/admin/disputes'); },
  adminReviewDispute(id, data) { return this.post('/admin/disputes/' + id + '/review', data); },
  adminGetRegions() { return this.get('/admin/regions'); },
  adminCreateRegion(data) { return this.post('/admin/regions', data); },
  adminUpdateRegion(id, data) { return this.put('/admin/regions/' + id, data); },
  adminDeleteRegion(id) { return this.del('/admin/regions/' + id); },

  // ===== 文件上传 =====
  upload(file) {
    const formData = new FormData();
    formData.append('file', file);
    const headers = {};
    if (this.token) headers['Authorization'] = 'Bearer ' + this.token;
    return fetch(API_BASE + '/upload', { method: 'POST', headers, body: formData }).then(r => r.json());
  }
};

// ===== 自动恢复token =====
API.token = Utils.get('token');

// ===== 检查登录状态 =====
function checkAuth(role) {
  const token = Utils.get('token');
  if (!token) {
    const paths = {
      user: '/user/orders.html',
      technician: '/technician/index.html',
      merchant: '/merchant/promote.html',
      admin: '/admin/login.html'
    };
    window.location.href = paths[role] || '/';
    return false;
  }
  API.token = token;
  return true;
}