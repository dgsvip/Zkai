const BASE_URL = '/api/v1'

function request<T = any>(options: UniApp.RequestOptions): Promise<T> {
  const token = uni.getStorageSync('token')
  return new Promise((resolve, reject) => {
    uni.request({
      ...options,
      url: BASE_URL + options.url,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.header
      },
      success: (res) => {
        const data = res.data as any
        if (data.code === 200 || data.code === 201) {
          resolve(data as T)
        } else {
          uni.showToast({ title: data.message || '请求失败', icon: 'none' })
          reject(data)
        }
      },
      fail: (err) => {
        uni.showToast({ title: '网络异常', icon: 'none' })
        reject(err)
      }
    })
  })
}

export const api = {
  // 用户端
  sendCode: (phone: string) => request({ url: '/user/verification-code', method: 'POST', data: { phone } }),
  login: (phone: string, code: string) => request<any>({ url: '/user/login', method: 'POST', data: { phone, code } }),
  getUserProfile: () => request<any>({ url: '/user/profile', method: 'GET' }),

  // 服务
  getCategories: () => request<any>({ url: '/services/categories', method: 'GET' }),
  getServiceItems: (categoryId?: number) => request<any>({ url: `/services/items${categoryId ? '?category_id=' + categoryId : ''}`, method: 'GET' }),

  // 订单
  createOrder: (data: any) => request<any>({ url: '/orders', method: 'POST', data }),
  getOrders: (params?: any) => request<any>({ url: '/orders', method: 'GET', data: params }),
  getOrderDetail: (orderNo: string) => request<any>({ url: `/orders/${orderNo}`, method: 'GET' }),
  cancelOrder: (orderNo: string, data?: any) => request<any>({ url: `/orders/${orderNo}/cancel`, method: 'POST', data }),
  getOrderTimeline: (orderNo: string) => request<any>({ url: `/orders/${orderNo}/timeline`, method: 'GET' }),
  evaluateOrder: (orderNo: string, data: any) => request<any>({ url: `/orders/${orderNo}/evaluate`, method: 'POST', data }),

  // 公告
  getAnnouncements: (page?: number) => request<any>({ url: `/announcements?page=${page || 1}`, method: 'GET' }),
  getAnnouncementDetail: (id: number) => request<any>({ url: `/announcements/${id}`, method: 'GET' }),

  // 师傅端
  technicianLogin: (phone: string, password: string) => request<any>({ url: '/technician/login', method: 'POST', data: { phone, password } }),
  getTechnicianOrders: (params: any) => request<any>({ url: '/technician/orders', method: 'GET', data: params }),
  acceptOrder: (orderNo: string) => request<any>({ url: '/technician/orders/accept', method: 'POST', data: { order_no: orderNo } }),
  completeOrder: (data: any) => request<any>({ url: '/technician/orders/complete', method: 'POST', data }),
  cancelTechnicianOrder: (data: any) => request<any>({ url: '/technician/orders/cancel', method: 'POST', data }),
  transferOrder: (data: any) => request<any>({ url: '/technician/orders/transfer', method: 'POST', data }),
  createSelfOrder: (data: any) => request<any>({ url: '/technician/orders/self', method: 'POST', data }),
  getTechnicianProfile: () => request<any>({ url: '/technician/profile', method: 'GET' }),
  getTechnicianStatistics: () => request<any>({ url: '/technician/statistics', method: 'GET' }),
  getTechnicianBalance: () => request<any>({ url: '/technician/balance', method: 'GET' }),
  toggleBusy: (busy: boolean) => request<any>({ url: '/technician/busy', method: 'PUT', data: { busy } }),

  // 商家端
  merchantLogin: (phone: string, password: string) => request<any>({ url: '/merchant/login', method: 'POST', data: { phone, password } }),
  merchantCreateOrder: (data: any) => request<any>({ url: '/merchant/orders', method: 'POST', data }),
  merchantGetOrders: () => request<any>({ url: '/merchant/orders', method: 'GET' }),
  merchantGetStatistics: () => request<any>({ url: '/merchant/statistics', method: 'GET' }),
  merchantGetIncome: () => request<any>({ url: '/merchant/income', method: 'GET' }),
  merchantWithdraw: (amount: number) => request<any>({ url: '/merchant/withdraw', method: 'POST', data: { amount } }),
}

export default api