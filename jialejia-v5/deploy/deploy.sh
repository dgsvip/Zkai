#!/bin/bash
# ============================================
# 佳乐家 · 部署打包脚本
# 在本地开发环境运行，自动打包并上传到服务器
# ============================================

set -e

# 配置（请修改为你的服务器信息）
SERVER_HOST="your-server.com"       # 服务器IP或域名
SERVER_USER="root"                  # SSH用户名
SERVER_PATH="/var/www/jialejia-v5"  # 部署路径
LOCAL_PATH="/workspace/jialejia-v5" # 本地项目路径

echo "========================================"
echo "  佳乐家 V5.0 - 部署打包"
echo "========================================"

# 1. 创建临时目录
TMP_DIR=$(mktemp -d)
echo "创建临时目录: $TMP_DIR"

# 2. 复制项目文件（排除开发文件）
echo "复制项目文件..."
rsync -av \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='data/*.db' \
    --exclude='logs' \
    --exclude='.env' \
    $LOCAL_PATH/ $TMP_DIR/

# 3. 创建生产环境 .env
cat > $TMP_DIR/.env << 'EOF'
PORT=3000
DB_PATH=./data/jialejia.db
JWT_SECRET=jialejia_secret_key_2024
NODE_ENV=production
EOF

# 4. 打包
TAR_FILE="jialejia-v5-$(date +%Y%m%d%H%M).tar.gz"
cd $TMP_DIR
tar czf /tmp/$TAR_FILE .
cd -

echo "打包完成: /tmp/$TAR_FILE"

# 5. 上传到服务器
echo "上传到服务器 $SERVER_HOST..."
scp /tmp/$TAR_FILE $SERVER_USER@$SERVER_HOST:/tmp/

# 6. 远程部署
ssh $SERVER_USER@$SERVER_HOST << 'CMD'
set -e
echo "远程部署开始..."
DEPLOY_DIR="/var/www/jialejia-v5"
BACKUP_DIR="/var/www/backups"
mkdir -p $BACKUP_DIR

# 备份当前版本
if [ -d "$DEPLOY_DIR" ]; then
    BACKUP_FILE="$BACKUP_DIR/jialejia-v5-$(date +%Y%m%d%H%M).tar.gz"
    tar czf $BACKUP_FILE -C $DEPLOY_DIR .
    echo "已备份当前版本: $BACKUP_FILE"
fi

# 解压新版本
mkdir -p $DEPLOY_DIR
tar xzf /tmp/$(ls /tmp/jialejia-v5-*.tar.gz | tail -1) -C $DEPLOY_DIR
rm -f /tmp/jialejia-v5-*.tar.gz

# 安装依赖
cd $DEPLOY_DIR
npm install --production

# 重启服务
pm2 startOrRestart deploy/ecosystem.config.js --env production
pm2 save

echo "部署完成！"
CMD

# 7. 清理临时文件
rm -rf $TMP_DIR
rm -f /tmp/$TAR_FILE

echo "========================================"
echo "  部署成功！"
echo "  访问地址: http://$SERVER_HOST"
echo "========================================"