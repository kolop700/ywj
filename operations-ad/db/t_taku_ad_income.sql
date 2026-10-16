-- ============================================================
-- Taku 广告展示收益明细表（S2S 回调累计）
-- 执行位置：运营库（operations-xy 连接的 192.168.1.252:3307 / Yefiot）
-- 说明：回调每次广告展示写入一条；req_id+adsource_id 唯一键用于去重；
--       income_date 为北京时间归属日期（按天汇总/生成收入用）
-- ============================================================
CREATE TABLE IF NOT EXISTS `t_taku_ad_income` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `req_id` varchar(64) NOT NULL DEFAULT '' COMMENT 'Taku回调唯一id（与adsource_id联合去重）',
  `adsource_id` int(11) NOT NULL DEFAULT 0 COMMENT '广告源id',
  `user_id` varchar(64) NOT NULL DEFAULT '' COMMENT '回调携带的开发者用户标识',
  `adformat` smallint(6) NOT NULL DEFAULT 0 COMMENT '0Native/1激励/2Banner/3插屏/4开屏',
  `placement_id` varchar(64) NOT NULL DEFAULT '' COMMENT 'Taku广告位id',
  `nw_firm_id` int(11) NOT NULL DEFAULT 0 COMMENT '三方广告平台id',
  `adsource_price` decimal(12,4) NOT NULL DEFAULT 0 COMMENT 'ECPM（美元），单次展示ecpm',
  `currency` varchar(8) NOT NULL DEFAULT 'USD' COMMENT '货币单位',
  `geo_short` varchar(8) NOT NULL DEFAULT '' COMMENT '国家短码',
  `package_name` varchar(64) NOT NULL DEFAULT '' COMMENT '应用包名',
  `client_ip` varchar(46) NOT NULL DEFAULT '' COMMENT '用户ip',
  `show_custom_ext` varchar(500) NOT NULL DEFAULT '' COMMENT '展示自定义扩展参数',
  `show_time` datetime DEFAULT NULL COMMENT '展示时间（北京时间）',
  `income_date` date NOT NULL COMMENT '归属日期（北京时间，按天汇总用）',
  `raw_data` varchar(1000) NOT NULL DEFAULT '' COMMENT '原始回调参数留档',
  `create_time` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_req_source` (`req_id`,`adsource_id`),
  KEY `idx_income_date` (`income_date`),
  KEY `idx_package_name` (`package_name`),
  KEY `idx_placement_id` (`placement_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='Taku广告展示收益明细';
