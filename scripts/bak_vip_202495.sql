-- MySQL dump 10.19  Distrib 10.3.28-MariaDB, for Linux (x86_64)
--
-- Host: rm-8vbj241vr8buqdfip.mysql.zhangbei.rds.aliyuncs.com    Database: yefiot
-- ------------------------------------------------------
-- Server version	8.0.36

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Dumping data for table `t_vip_order`
--
-- WHERE:  user_id='202495'

LOCK TABLES `t_vip_order` WRITE;
/*!40000 ALTER TABLE `t_vip_order` DISABLE KEYS */;
INSERT INTO `t_vip_order` (`id`, `out_trade_no`, `user_id`, `product_id`, `title`, `months`, `amount`, `pay_type`, `platform`, `status`, `transaction_id`, `paid_at`, `granted_at`, `created_at`) VALUES (3,'VIP20261013112013599423','202495','vip_month_1','月度会员',1,600,'wechat','android',0,NULL,NULL,NULL,'2026-10-13 11:20:13'),(4,'VIP20261013112015604877','202495','vip_month_1','月度会员',1,600,'wechat','android',0,NULL,NULL,NULL,'2026-10-13 11:20:15'),(5,'VIP20261014150737616726','202495','vip_month_3','季度会员',3,1500,'wechat','android',0,NULL,NULL,NULL,'2026-10-14 15:07:37'),(6,'VIP20261014150755430613','202495','vip_month_3','季度会员',3,1500,'wechat','android',0,NULL,NULL,NULL,'2026-10-14 15:07:55'),(10,'VIP20261016111104759407','202495','vip_month_6','半年免广告',6,1500,'wechat_mini','miniapp',0,NULL,NULL,NULL,'2026-10-16 11:11:04'),(11,'VIP20261016111344578383','202495','vip_month_6','半年免广告',6,1,'wechat','android',2,NULL,NULL,NULL,'2026-10-16 11:13:44'),(13,'VIP20261016111728935987','202495','vip_month_6','半年免广告',6,1,'wechat_mini','miniapp',1,'4500000560202610168815410449','2026-10-16 11:17:35','2026-10-16 11:17:35','2026-10-16 11:17:28');
/*!40000 ALTER TABLE `t_vip_order` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-16 14:54:17
