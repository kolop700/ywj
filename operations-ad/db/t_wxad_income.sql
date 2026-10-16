-- ============================================================
-- 微信小程序流量主收益表（接口拉取，按广告位类型日汇总）
-- 执行位置：运营库（operations-xy 连接的 192.168.1.252:3307 / Yefiot）
-- 说明：数据来自微信流量主接口 publisher_adpos_general（T+1更新，数据会修正）；
--       income_date+ad_slot 唯一键，同步时已存在则覆盖更新；
--       income_fen 为收入（单位：分），展示时除以100为元
-- ============================================================
CREATE TABLE IF NOT EXISTS `t_wxad_income` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `income_date` date NOT NULL COMMENT '数据日期',
  `ad_slot` varchar(64) NOT NULL DEFAULT '' COMMENT '广告位类型（如SLOT_ID_WEAPP_BANNER）',
  `req_succ_count` bigint(20) NOT NULL DEFAULT 0 COMMENT '拉取量',
  `exposure_count` bigint(20) NOT NULL DEFAULT 0 COMMENT '曝光量',
  `click_count` bigint(20) NOT NULL DEFAULT 0 COMMENT '点击量',
  `income_fen` bigint(20) NOT NULL DEFAULT 0 COMMENT '收入（分）',
  `ecpm_fen` decimal(16,4) NOT NULL DEFAULT 0 COMMENT '千次曝光收益（分）',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_date_slot` (`income_date`,`ad_slot`),
  KEY `idx_income_date` (`income_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='微信小程序流量主收益（按广告位类型日汇总）';
