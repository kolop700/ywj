-- =====================================================================
-- VIP 会员功能数据表建表脚本（数据库：Yefiot）
-- 执行方式：数据库管理工具（Navicat/phpMyAdmin）或命令行：
--   mysql -uroot -p Yefiot < install.sql
-- 说明：仅新建 1 张订单表；会员到期时间复用现有 t_app_user.user_ad_end 字段
--       （不建 t_vip_user 表，与现有登录/广告字段体系打通，改动面最小）。
-- =====================================================================

-- 订单表：VIP 开通订单（微信/支付宝/IAP 共用）
CREATE TABLE IF NOT EXISTS `t_vip_order` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `out_trade_no` VARCHAR(64) NOT NULL COMMENT '商户订单号（VIP开头，唯一）',
  `user_id` VARCHAR(64) NOT NULL COMMENT '用户ID',
  `product_id` VARCHAR(64) NOT NULL COMMENT '商品档位ID（见 v1/vip_products.php）',
  `title` VARCHAR(128) DEFAULT NULL COMMENT '商品名称（快照）',
  `months` INT DEFAULT NULL COMMENT '购买月数（快照）',
  `amount` INT NOT NULL COMMENT '实付金额（单位：分）',
  `pay_type` VARCHAR(16) DEFAULT NULL COMMENT '支付方式：wechat/alipay/iap',
  `platform` VARCHAR(16) DEFAULT NULL COMMENT '平台：android/ios',
  `status` TINYINT DEFAULT 0 COMMENT '订单状态：0待支付 1已支付 2已关闭',
  `transaction_id` VARCHAR(128) DEFAULT NULL COMMENT '第三方交易号（微信/支付宝/苹果）',
  `paid_at` DATETIME DEFAULT NULL COMMENT '支付完成时间',
  `granted_at` DATETIME DEFAULT NULL COMMENT '会员入账完成时间（非空=已顺延完成，入账幂等原子标记）',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_out_trade_no` (`out_trade_no`),
  KEY `idx_user` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='VIP 开通订单表';
