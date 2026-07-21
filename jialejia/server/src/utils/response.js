class Response {
  static success(data = null, message = '操作成功') {
    return {
      code: 200,
      message,
      data,
      timestamp: Date.now()
    };
  }

  static created(data = null, message = '创建成功') {
    return {
      code: 201,
      message,
      data,
      timestamp: Date.now()
    };
  }

  static error(message = '操作失败', code = 400, data = null) {
    return {
      code,
      message,
      data,
      timestamp: Date.now()
    };
  }

  static unauthorized(message = '未授权') {
    return {
      code: 401,
      message,
      data: null,
      timestamp: Date.now()
    };
  }

  static forbidden(message = '无权限') {
    return {
      code: 403,
      message,
      data: null,
      timestamp: Date.now()
    };
  }

  static notFound(message = '资源不存在') {
    return {
      code: 404,
      message,
      data: null,
      timestamp: Date.now()
    };
  }

  static serverError(message = '服务器内部错误') {
    return {
      code: 500,
      message,
      data: null,
      timestamp: Date.now()
    };
  }
}

module.exports = Response;