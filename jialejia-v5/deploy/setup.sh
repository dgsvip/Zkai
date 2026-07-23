#!/bin/bash
# ============================================
# 佳乐家 · 服务器初始化脚本
# 适用于 Ubuntu 20.04+ / CentOS 7+
# ============================================

set -e

echo "========================================"
echo "  佳乐家 V5.0 - 服务器环境初始化"
echo "========================================"

# 检测操作系统
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    OS=$(uname -s)
fi

echo "检测到系统: $OS"

# 1. 更新系统
echo "[1/7] 更新系统包..."
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    apt-get update -y && apt-get upgrade -y
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
    yum update -y
fi

# 2. 安装 Node.js (18 LTS)
echo "[2/7] 安装 Node.js 18 LTS..."
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
    curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
    yum install -y nodejs
fi

# 3. 安装 PM2 进程守护
echo "[3/7] 安装 PM2..."
npm install -g pm2

# 4. 安装 Nginx
echo "[4/7] 安装 Nginx..."
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    apt-get install -y nginx
elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ]; then
    yum install -y nginx
fi

# 5. 创建项目目录
echo "[5/7] 创建项目目录..."
DEPLOY_DIR="/var/www/jialejia-v5"
mkdir -p $DEPLOY_DIR
mkdir -p $DEPLOY_DIR/data
mkdir -p $DEPLOY_DIR/logs
mkdir -p $DEPLOY_DIR/uploads

# 6. 复制配置文件
echo "[6/7] 配置 Nginx..."
cp deploy/nginx.conf /etc/nginx/sites-available/jialejia-v5.conf 2>/dev/null || \
cp deploy/nginx.conf /etc/nginx/conf.d/jialejia-v5.conf 2>/dev/null || true

# 启用站点（Ubuntu/Debian）
if [ -d /etc/nginx/sites-enabled ]; then
    ln -sf /etc/nginx/sites-available/jialejia-v5.conf /etc/nginx/sites-enabled/
fi

# 测试 Nginx 配置
nginx -t && systemctl restart nginx

# 7. 安装项目依赖
echo "[7/7] 安装项目依赖..."
cd $DEPLOY_DIR
npm install --production

echo "========================================"
echo "  初始化完成！"
echo "  启动命令: pm2 start deploy/ecosystem.config.js --env production"
echo "  查看状态: pm2 status"
echo "  查看日志: pm2 logs jialejia-v5"
echo "========================================"